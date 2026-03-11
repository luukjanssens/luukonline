import { Chat } from "./Chat";
import { buildDevicePageHtml } from "./devicePage";
import { OnlineStatus } from "./OnlineStatus";

export { Chat, OnlineStatus };

interface Env {
	ONLINE_STATUS: DurableObjectNamespace;
	CHAT: DurableObjectNamespace;
	ASSETS: Fetcher;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/chat" || url.pathname === "/telegram-webhook") {
			const id = env.CHAT.idFromName("singleton");
			const stub = env.CHAT.get(id);
			return stub.fetch(request);
		}

		if (url.pathname === "/device" || url.pathname === "/status") {
			// Non-WebSocket GET to /device → serve the phone page
			if (
				url.pathname === "/device" &&
				request.headers.get("Upgrade") !== "websocket"
			) {
				return new Response(buildDevicePageHtml(), {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			// Route WebSocket upgrades to the Durable Object
			const id = env.ONLINE_STATUS.idFromName("singleton");
			const stub = env.ONLINE_STATUS.get(id);
			return stub.fetch(request);
		}

		// Everything else: serve the built frontend assets
		return env.ASSETS.fetch(request);
	},
};
