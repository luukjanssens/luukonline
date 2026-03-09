import { DurableObject } from "cloudflare:workers";

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

interface TelegramSendResult {
	ok: boolean;
	result?: { message_id: number };
}

interface VisitorMeta {
	ip: string | null;
	country: string | null;
	city: string | null;
	region: string | null;
	postalCode: string | null;
	lat: string | null;
	lon: string | null;
	timezone: string | null;
	org: string | null;
	ua: string | null;
	lang: string | null;
	referer: string | null;
}

export class Chat extends DurableObject<ChatEnv> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/chat") {
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const { 0: client, 1: server } = new WebSocketPair();
			const sessionId = crypto.randomUUID();

			const cf = request.cf;
			const meta: VisitorMeta = {
				ip: request.headers.get("CF-Connecting-IP"),
				country: (cf?.country as string) ?? null,
				city: (cf?.city as string) ?? null,
				region: (cf?.region as string) ?? null,
				postalCode: (cf?.postalCode as string) ?? null,
				lat: (cf?.latitude as string) ?? null,
				lon: (cf?.longitude as string) ?? null,
				timezone: (cf?.timezone as string) ?? null,
				org: (cf?.asOrganization as string) ?? null,
				ua: request.headers.get("User-Agent"),
				lang: request.headers.get("Accept-Language"),
				referer: request.headers.get("Referer"),
			};
			await this.ctx.storage.put(`meta:${sessionId}`, meta);

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
			await fetch(
				`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						chat_id: this.env.TELEGRAM_CHAT_ID,
						text: `🚫 [${sessionId}] Location denied`,
					}),
				},
			);
			return;
		}

		if (data.type === "location" && data.lat != null && data.lon != null) {
			const accuracy = data.accuracy ? ` (±${Math.round(data.accuracy)}m)` : "";
			const mapsLink = `https://maps.google.com/?q=${data.lat},${data.lon}`;
			await fetch(
				`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						chat_id: this.env.TELEGRAM_CHAT_ID,
						text: `📍 [${sessionId}] Location${accuracy}\n${mapsLink}`,
					}),
				},
			);
			return;
		}

		if (data.type !== "message" || !data.text?.trim()) return;

		const text = data.text.trim().slice(0, 500);

		// Echo back to visitor immediately
		socket.send(
			JSON.stringify({
				type: "message",
				from: "visitor",
				text,
				timestamp: Date.now(),
			}),
		);

		const meta = await this.ctx.storage.get<VisitorMeta>(`meta:${sessionId}`);
		const location = [meta?.city, meta?.postalCode, meta?.region, meta?.country]
			.filter(Boolean)
			.join(", ");
		const metaLines = [
			location && `🌍 ${location}`,
			meta?.timezone && `🕐 ${meta.timezone}`,
			meta?.org && `📡 ${meta.org}`,
			meta?.ip && `🔗 ${meta.ip}`,
			meta?.referer && `↩️ ${meta.referer}`,
			meta?.lang && `🗣️ ${meta.lang}`,
			meta?.ua && `🖥️ ${meta.ua}`,
		]
			.filter(Boolean)
			.join("\n");

		// Forward to Telegram
		const resp = await fetch(
			`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: this.env.TELEGRAM_CHAT_ID,
					text: `💬 [${sessionId}]\n${text}${metaLines ? `\n\n${metaLines}` : ""}`,
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

		if (msg.text === "/location") {
			socket.send(JSON.stringify({ type: "location_request" }));
			return;
		}

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
