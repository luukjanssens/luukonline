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

interface BlockEntry {
	blockedAt: number;
	ip?: string;
	reason?: string;
}

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_AUTO_BLOCK_STRIKES = 3;

export class Chat extends DurableObject<ChatEnv> {
		private rateLimitMap = new Map<string, number[]>();
		private rateLimitStrikes = new Map<string, number>();
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
				const ip = visitorMetadata.ip ?? undefined;

				if (await this.isBlocked(sessionId, ip)) {
					this.ctx.acceptWebSocket(server, ["visitor", sessionId]);
					server.close(4403, "blocked");
					return new Response(null, { status: 101, webSocket: client });
				}

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
			if (sessionId) {
				this.ctx.waitUntil(this.ctx.storage.delete(`meta:${sessionId}`));
				this.rateLimitMap.delete(sessionId);
				this.rateLimitStrikes.delete(sessionId);
			}
		}

		webSocketError(_socket: WebSocket, _error: unknown): void {}

		private async processMessage(
			socket: WebSocket,
			raw: string,
		): Promise<void> {
			const tags = this.ctx.getTags(socket);
			const sessionId = tags[1] ?? "unknown";

			if (await this.isBlocked(sessionId)) return;

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
				const accuracy = data.accuracy
					? ` (±${Math.round(data.accuracy)}m)`
					: "";
				const mapsLink = `https://maps.google.com/?q=${data.lat},${data.lon}`;
				await sendTelegramMessage(
					this.env.TELEGRAM_BOT_TOKEN,
					this.env.TELEGRAM_CHAT_ID,
					`📍 [${sessionId}] Location${accuracy}\n${mapsLink}`,
				);
				return;
			}

			if (data.type !== "message" || !data.text?.trim()) return;

			if (this.checkRateLimit(sessionId)) {
				socket.send(JSON.stringify({ type: "rate_limited" }));
				const strikes = (this.rateLimitStrikes.get(sessionId) ?? 0) + 1;
				this.rateLimitStrikes.set(sessionId, strikes);
				if (strikes >= RATE_LIMIT_AUTO_BLOCK_STRIKES) {
					this.ctx.waitUntil(this.autoBlockSession(sessionId));
				}
				return;
			}
			this.rateLimitStrikes.set(sessionId, 0);

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
				await this.ctx.storage.put(
					`msg:${result.result.message_id}`,
					sessionId,
				);
			}
		}

		private async handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
			const telegramMessage = update.message;
			if (!telegramMessage?.text) return;

			const text = telegramMessage.text.trim();

			// Standalone commands (no reply needed)
			if (text === "/help") {
				await this.sendTelegram(
					[
						"📖 Commands:",
						"",
						"Reply to a visitor message:",
						"  /block — block that session",
						"  /block ip — block session + their IP",
						"  /unblock — unblock that session",
						"  /location — request visitor's location",
						"  (any text) — reply to visitor",
						"",
						"Standalone:",
						"  /blocklist — list all active blocks",
						"  /unblock {sessionId} — unblock by ID",
						"  /unblockip {ip} — unblock an IP",
						"  /help — show this message",
					].join("\n"),
				);
				return;
			}
			if (text === "/blocklist") {
				await this.handleBlocklistCommand();
				return;
			}
			if (text.startsWith("/unblockip ")) {
				const ip = text.slice("/unblockip ".length).trim();
				if (ip) await this.unblockIp(ip);
				return;
			}
			// Standalone /unblock with sessionId argument
			if (text.startsWith("/unblock ") && !telegramMessage.reply_to_message) {
				const sid = text.slice("/unblock ".length).trim();
				if (sid) await this.unblockSession(sid);
				return;
			}

			// Reply-based commands require a reply_to_message
			if (!telegramMessage.reply_to_message?.message_id) return;

			const sessionId = await this.ctx.storage.get<string>(
				`msg:${telegramMessage.reply_to_message.message_id}`,
			);
			if (!sessionId) return;

			if (text === "/block" || text === "/block ip") {
				const ip =
					text === "/block ip"
						? ((
								await this.ctx.storage.get<VisitorMetadata>(`meta:${sessionId}`)
							)?.ip ?? undefined)
						: undefined;
				await this.blockSession(sessionId, ip);
				return;
			}

			if (text === "/unblock") {
				await this.unblockSession(sessionId);
				return;
			}

			if (text === "/location") {
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

		// ── Block / Unblock ──────────────────────────────────────────────

		private async isBlocked(sessionId: string, ip?: string): Promise<boolean> {
			const checks: Promise<BlockEntry | undefined>[] = [
				this.ctx.storage.get<BlockEntry>(`blocked:session:${sessionId}`),
			];
			if (ip) checks.push(this.ctx.storage.get<BlockEntry>(`blocked:ip:${ip}`));
			const results = await Promise.all(checks);
			return results.some(Boolean);
		}

		private async blockSession(sessionId: string, ip?: string): Promise<void> {
			const entry: BlockEntry = { blockedAt: Date.now(), ip };
			await this.ctx.storage.put(`blocked:session:${sessionId}`, entry);

			if (ip) {
				await this.ctx.storage.put(`blocked:ip:${ip}`, {
					blockedAt: Date.now(),
				} satisfies BlockEntry);
			}

			this.closeSessionSocket(sessionId);

			const ipNote = ip ? ` + IP ${ip} (⚠️ may affect other users)` : "";
			await this.sendTelegram(`🚫 Blocked session ${sessionId}${ipNote}`);
		}

		private async unblockSession(sessionId: string): Promise<void> {
			const entry = await this.ctx.storage.get<BlockEntry>(
				`blocked:session:${sessionId}`,
			);
			await this.ctx.storage.delete(`blocked:session:${sessionId}`);
			if (entry?.ip) {
				await this.ctx.storage.delete(`blocked:ip:${entry.ip}`);
			}
			await this.sendTelegram(`✅ Unblocked session ${sessionId}`);
		}

		private async unblockIp(ip: string): Promise<void> {
			await this.ctx.storage.delete(`blocked:ip:${ip}`);
			await this.sendTelegram(`✅ Unblocked IP ${ip}`);
		}

		private async handleBlocklistCommand(): Promise<void> {
			const allKeys = await this.ctx.storage.list<BlockEntry>({
				prefix: "blocked:",
			});
			if (allKeys.size === 0) {
				await this.sendTelegram("📋 No active blocks");
				return;
			}
			const lines: string[] = [];
			for (const [key, entry] of allKeys) {
				const since = new Date(entry.blockedAt).toISOString().slice(0, 10);
				lines.push(`• ${key.replace("blocked:", "")} (since ${since})`);
			}
			await this.sendTelegram(`📋 Active blocks:\n${lines.join("\n")}`);
		}

		private closeSessionSocket(sessionId: string): void {
			const sockets = this.ctx.getWebSockets("visitor");
			for (const socket of sockets) {
				if (this.ctx.getTags(socket)[1] === sessionId) {
					socket.close(4403, "blocked");
				}
			}
		}

		// ── Rate Limiting ────────────────────────────────────────────────

		private checkRateLimit(sessionId: string): boolean {
			const now = Date.now();
			const timestamps = this.rateLimitMap.get(sessionId) ?? [];
			const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
			if (recent.length >= RATE_LIMIT_MAX) {
				this.rateLimitMap.set(sessionId, recent);
				return true;
			}
			recent.push(now);
			this.rateLimitMap.set(sessionId, recent);
			return false;
		}

		private async autoBlockSession(sessionId: string): Promise<void> {
			await this.blockSession(sessionId);
			await this.sendTelegram(
				`⚠️ Auto-blocked session ${sessionId} (rate limit exceeded ${RATE_LIMIT_AUTO_BLOCK_STRIKES}x)`,
			);
		}

		private async sendTelegram(text: string): Promise<void> {
			await sendTelegramMessage(
				this.env.TELEGRAM_BOT_TOKEN,
				this.env.TELEGRAM_CHAT_ID,
				text,
			);
		}
	}
