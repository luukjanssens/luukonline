import { DurableObject } from "cloudflare:workers";
import { sendTelegramMessage } from "./telegram";
import {
	extractVisitorMetadata,
	formatMetadataLines,
	type VisitorMetadata,
} from "./visitorMetadata";

interface ChatEnv {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

interface IncomingMessage {
	type: string;
	text?: string;
	lat?: number;
	lon?: number;
	accuracy?: number;
}

interface TelegramUpdate {
	message?: {
		text?: string;
		reply_to_message?: { message_id?: number };
	};
}

interface HistoryEntry {
	from: "visitor" | "luuk";
	text: string;
	timestamp: number;
}

interface HistoryStore {
	messages: HistoryEntry[];
	createdAt: number;
}

export class Chat extends DurableObject<ChatEnv> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/chat") {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const { 0: client, 1: server } = new WebSocketPair();
			const UUID_V4 =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			const rawId = url.searchParams.get("sessionId") ?? "";
			const sessionId = UUID_V4.test(rawId) ? rawId : crypto.randomUUID();

			const visitorMetadata = extractVisitorMetadata(request);
			await this.ctx.storage.put(`meta:${sessionId}`, visitorMetadata);

			this.ctx.acceptWebSocket(server, ["visitor", sessionId]);

			const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
			const history = await this.ctx.storage.get<HistoryStore>(
				`history:${sessionId}`,
			);
			if (history) {
				if (Date.now() - history.createdAt > THIRTY_DAYS_MS) {
					await this.ctx.storage.delete(`history:${sessionId}`);
				} else if (history.messages.length > 0) {
					server.send(
						JSON.stringify({ type: "history", messages: history.messages }),
					);
				}
			}

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
		socket: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): void {
		const sessionId = this.ctx.getTags(socket)[1];
		if (sessionId)
			this.ctx.waitUntil(this.ctx.storage.delete(`meta:${sessionId}`));
	}

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

		if (data.type === "location_denied") {
			await sendTelegramMessage(
				this.env.TELEGRAM_BOT_TOKEN,
				this.env.TELEGRAM_CHAT_ID,
				`🚫 [${sessionId}] Location denied`,
			);
			return;
		}

		if (data.type === "location" && data.lat != null && data.lon != null) {
			const accuracy = data.accuracy ? ` (±${Math.round(data.accuracy)}m)` : "";
			const mapsLink = `https://maps.google.com/?q=${data.lat},${data.lon}`;
			await sendTelegramMessage(
				this.env.TELEGRAM_BOT_TOKEN,
				this.env.TELEGRAM_CHAT_ID,
				`📍 [${sessionId}] Location${accuracy}\n${mapsLink}`,
			);
			return;
		}

		if (data.type !== "message" || !data.text?.trim()) return;

		const text = data.text.trim().slice(0, 500);

		const timestamp = Date.now();

		// Echo back to visitor immediately
		socket.send(
			JSON.stringify({
				type: "message",
				from: "visitor",
				text,
				timestamp,
			}),
		);

		await this.appendToHistory(sessionId, {
			from: "visitor",
			text,
			timestamp,
		});

		const visitorMetadata = await this.ctx.storage.get<VisitorMetadata>(
			`meta:${sessionId}`,
		);
		const metadataLines = visitorMetadata
			? formatMetadataLines(visitorMetadata)
			: "";

		// Forward to Telegram
		const result = await sendTelegramMessage(
			this.env.TELEGRAM_BOT_TOKEN,
			this.env.TELEGRAM_CHAT_ID,
			`💬 [${sessionId}]\n${text}${metadataLines ? `\n\n${metadataLines}` : ""}`,
		);
		if (result.ok && result.result?.message_id) {
			// Store telegram message_id → sessionId so replies can be routed back
			await this.ctx.storage.put(`msg:${result.result.message_id}`, sessionId);
		}
	}

	private async handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
		const telegramMessage = update.message;
		if (!telegramMessage?.text || !telegramMessage.reply_to_message?.message_id)
			return;

		// Look up which visitor session this reply belongs to
		const sessionId = await this.ctx.storage.get<string>(
			`msg:${telegramMessage.reply_to_message.message_id}`,
		);
		if (!sessionId) return;

		if (telegramMessage.text === "/location") {
			// Location requests are only meaningful if the visitor is currently connected
			const socket = this.ctx
				.getWebSockets("visitor")
				.find((candidate) => this.ctx.getTags(candidate)[1] === sessionId);
			if (socket) socket.send(JSON.stringify({ type: "location_request" }));
			return;
		}

		const timestamp = Date.now();
		// Always persist to history so offline visitors see it on reconnect
		await this.appendToHistory(sessionId, {
			from: "luuk",
			text: telegramMessage.text,
			timestamp,
		});

		// Live-deliver only if the visitor is currently connected
		const socket = this.ctx
			.getWebSockets("visitor")
			.find((candidate) => this.ctx.getTags(candidate)[1] === sessionId);
		if (socket) {
			socket.send(
				JSON.stringify({
					type: "message",
					from: "luuk",
					text: telegramMessage.text,
					timestamp,
				}),
			);
		}
	}

	private async appendToHistory(
		sessionId: string,
		entry: HistoryEntry,
	): Promise<void> {
		const stored = await this.ctx.storage.get<HistoryStore>(
			`history:${sessionId}`,
		);
		const store: HistoryStore = stored ?? {
			messages: [],
			createdAt: Date.now(),
		};
		store.messages.push(entry);
		if (store.messages.length > 100) {
			store.messages = store.messages.slice(-100);
		}
		await this.ctx.storage.put(`history:${sessionId}`, store);
	}
}
