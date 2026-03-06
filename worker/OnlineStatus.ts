import { DurableObject } from "cloudflare:workers";

function normalizeDeviceName(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes("iphone") || lower.includes("phone")) return "phone";
	if (lower.includes("macbook") || lower.includes("laptop")) return "laptop";
	return lower;
}

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

		// For device connections, include the name and connect timestamp as extra tags
		const tags = isDevice
			? [
					"device",
					normalizeDeviceName(url.searchParams.get("name") ?? "unknown"),
					Date.now().toString(),
				]
			: ["browser"];
		this.ctx.acceptWebSocket(serverWs, tags);

		// Send current status immediately to new browser connections
		if (isBrowser) {
			this.ctx.waitUntil(this.sendStatus(serverWs));
		}

		// Notify browsers when a new device connects
		if (isDevice) {
			this.ctx.waitUntil(this.broadcastStatus());
		}

		return new Response(null, { status: 101, webSocket: clientWs });
	}

	webSocketClose(
		socket: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): void {
		const tags = this.ctx.getTags(socket);
		if (tags[0] === "device") {
			this.ctx.waitUntil(
				this.ctx.storage
					.put("lastSeen", {
						timestamp: Date.now(),
						name: tags[1] ?? "unknown",
					})
					.then(() => this.broadcastStatus()),
			);
		} else {
			this.ctx.waitUntil(this.broadcastStatus());
		}
	}

	webSocketError(socket: WebSocket, _error: unknown): void {
		this.webSocketClose(socket, 0, "", false);
	}

	webSocketMessage(_socket: WebSocket, _message: string | ArrayBuffer): void {
		// devices don't send messages
	}

	private currentStatus() {
		const devices = this.ctx.getWebSockets("device");
		// Tags: ["device", name, connectedAt]
		const deviceInfo = devices.map((socket) => {
			const tags = this.ctx.getTags(socket);
			return {
				name: tags[1] ?? "Unknown",
				connectedAt: Number(tags[2] ?? "0"),
			};
		});
		const online = devices.length > 0;
		return {
			online,
			devices: devices.length,
			deviceNames: deviceInfo.map((device) => device.name),
			deviceInfo,
			timestamp: Date.now(),
		};
	}

	private async buildPayload(): Promise<string> {
		const status = this.currentStatus();
		const lastSeen = status.online
			? null
			: ((await this.ctx.storage.get<{ ts: number; name: string }>(
					"lastSeen",
				)) ?? null);
		return JSON.stringify({ ...status, lastSeen });
	}

	private async sendStatus(socket: WebSocket): Promise<void> {
		try {
			socket.send(await this.buildPayload());
		} catch {}
	}

	private async broadcastStatus(): Promise<void> {
		const payload = await this.buildPayload();
		for (const socket of this.ctx.getWebSockets("browser")) {
			try {
				socket.send(payload);
			} catch {}
		}
	}
}
