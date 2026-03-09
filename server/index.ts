import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = process.env.PORT ?? 8080;
const wss = new WebSocketServer({ port: Number(PORT) });

interface Client {
	socket: WebSocket;
	type: "laptop" | "browser";
	name: string;
	connectedAt: number;
}

const clients = new Set<Client>();

wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
	const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);
	// Accept both /laptop (legacy) and /device (matches the Worker path)
	const isLaptop =
		reqUrl.pathname === "/laptop" || reqUrl.pathname === "/device";
	const isBrowser = reqUrl.pathname === "/status";

	if (!isLaptop && !isBrowser) {
		socket.close();
		return;
	}

	const name = reqUrl.searchParams.get("name") ?? "Unknown";
	clients.add({
		socket,
		type: isLaptop ? "laptop" : "browser",
		name,
		connectedAt: Date.now(),
	});
	console.log(
		`[+] ${isLaptop ? `Laptop (${name})` : "Browser"} connected (${clients.size} total)`,
	);

	// Broadcast status to all browser clients
	broadcast();

	socket.on("close", () => {
		clients.forEach((client) => {
			if (client.socket === socket) clients.delete(client);
		});
		console.log(
			`[-] ${isLaptop ? `Laptop (${name})` : "Browser"} disconnected (${clients.size} total)`,
		);
		broadcast();
	});

	socket.on("error", () => {});
});

function broadcast(): void {
	const laptops = [...clients].filter((client) => client.type === "laptop");
	const payload = JSON.stringify({
		online: laptops.length > 0,
		devices: laptops.length,
		deviceNames: laptops.map((client) => client.name),
		deviceInfo: laptops.map((client) => ({
			name: client.name,
			connectedAt: client.connectedAt,
		})),
		timestamp: Date.now(),
	});
	clients.forEach(({ socket, type }) => {
		if (type === "browser" && socket.readyState === WebSocket.OPEN) {
			socket.send(payload);
		}
	});
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(
	`  Laptop connects to:  ws://localhost:${PORT}/device?name=<hostname>`,
);
console.log(`  Browser connects to: ws://localhost:${PORT}/status`);
