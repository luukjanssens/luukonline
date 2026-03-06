import { DurableObject } from "cloudflare:workers";

export class OnlineStatus extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const isDevice = url.pathname === "/device";
		const isBrowser = url.pathname === "/status";

		if (!isDevice && !isBrowser) {
			return new Response("Not found", { status: 404 });
		}

		const upgradeHeader = request.headers.get("Upgrade");
		if (upgradeHeader !== "websocket") {
			return new Response("Expected WebSocket", { status: 426 });
		}

		const { 0: clientWs, 1: serverWs } = new WebSocketPair();

		// For device connections, include the name as an extra tag so we can retrieve it later
		const tags = isDevice
			? ["device", url.searchParams.get("name") ?? "Unknown"]
			: ["browser"];
		this.ctx.acceptWebSocket(serverWs, tags);

		// Send current status immediately to new browser connections
		if (isBrowser) {
			serverWs.send(JSON.stringify(this.currentStatus()));
		}

		// Notify browsers when a new device connects
		if (isDevice) {
			this.broadcast();
		}

		return new Response(null, { status: 101, webSocket: clientWs });
	}

	webSocketClose(
		_ws: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): void {
		this.broadcast();
	}

	webSocketError(_ws: WebSocket, _error: unknown): void {
		this.broadcast();
	}

	webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
		// devices don't send messages
	}

	private currentStatus() {
		const devices = this.ctx.getWebSockets("device");
		// The second tag on each device socket is its name
		const deviceNames = devices.map((ws) => {
			const tags = this.ctx.getTags(ws);
			return tags[1] ?? "Unknown";
		});
		return {
			online: devices.length > 0,
			devices: devices.length,
			deviceNames,
			ts: Date.now(),
		};
	}

	private broadcast(): void {
		const browsers = this.ctx.getWebSockets("browser");
		const payload = JSON.stringify(this.currentStatus());
		for (const ws of browsers) {
			try {
				ws.send(payload);
			} catch {}
		}
	}
}
