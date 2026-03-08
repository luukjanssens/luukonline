import { DurableObject } from "cloudflare:workers";

interface ChatEnv {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

interface IncomingMessage {
	type: string;
	text?: string;
}

interface TelegramUpdate {
	message?: {
		text?: string;
		reply_to_message?: { message_id?: number };
	};
}

interface TelegramSendResult {
	ok: boolean;
	result?: { message_id: number };
}

function randomId(): string {
	return Math.random().toString(36).slice(2, 10);
}

export class Chat extends DurableObject<ChatEnv> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/chat") {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const { 0: client, 1: server } = new WebSocketPair();
			const sessionId = randomId();
			this.ctx.acceptWebSocket(server, ["visitor", sessionId]);
			server.send(JSON.stringify({ type: "connected", sessionId }));
			return new Response(null, { status: 101, webSocket: client });
		}

		if (url.pathname === "/telegram-webhook") {
			const body = (await request.json()) as TelegramUpdate;
			await this.handleTelegramWebhook(body);
			return new Response("ok");
		}

		return new Response("Not found", { status: 404 });
	}

	webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
		if (typeof message !== "string") return;
		this.ctx.waitUntil(this.processMessage(socket, message));
	}

	webSocketClose(
		_socket: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): void {}

	webSocketError(_socket: WebSocket, _error: unknown): void {}

	private async processMessage(socket: WebSocket, raw: string): Promise<void> {
		const tags = this.ctx.getTags(socket);
		const sessionId = tags[1] ?? "unknown";

		let data: IncomingMessage;
		try {
			data = JSON.parse(raw) as IncomingMessage;
		} catch {
			return;
		}

		if (data.type !== "message" || !data.text?.trim()) return;

		const text = data.text.trim().slice(0, 500);

		// Echo back to visitor immediately
		socket.send(
			JSON.stringify({ type: "message", from: "visitor", text, timestamp: Date.now() }),
		);

		// Forward to Telegram
		const resp = await fetch(
			`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: this.env.TELEGRAM_CHAT_ID,
					text: `💬 [${sessionId}]\n${text}`,
				}),
			},
		);

		const result = (await resp.json()) as TelegramSendResult;
		if (result.ok && result.result?.message_id) {
			// Store telegram message_id → sessionId so replies can be routed back
			await this.ctx.storage.put(`msg:${result.result.message_id}`, sessionId);
		}
	}

	private async handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
		const msg = update.message;
		if (!msg?.text || !msg.reply_to_message?.message_id) return;

		// Look up which visitor session this reply belongs to
		const sessionId = await this.ctx.storage.get<string>(
			`msg:${msg.reply_to_message.message_id}`,
		);
		if (!sessionId) return;

		// Find the active WebSocket for that session
		const socket = this.ctx
			.getWebSockets("visitor")
			.find((s) => this.ctx.getTags(s)[1] === sessionId);
		if (!socket) return;

		socket.send(
			JSON.stringify({
				type: "message",
				from: "luuk",
				text: msg.text,
				timestamp: Date.now(),
			}),
		);
	}
}
