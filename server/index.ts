import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = process.env.PORT ?? 8080;
const wss = new WebSocketServer({ port: Number(PORT) });

interface Client {
	ws: WebSocket;
	type: "laptop" | "browser";
	name: string;
}

const clients = new Set<Client>();

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
	const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);
	// Accept both /laptop (legacy) and /device (matches the Worker path)
	const isLaptop =
		reqUrl.pathname === "/laptop" || reqUrl.pathname === "/device";
	const isBrowser = reqUrl.pathname === "/status";

	if (!isLaptop && !isBrowser) {
		ws.close();
		return;
	}

	const name = reqUrl.searchParams.get("name") ?? "Unknown";
	clients.add({ ws, type: isLaptop ? "laptop" : "browser", name });
	console.log(
		`[+] ${isLaptop ? `Laptop (${name})` : "Browser"} connected (${clients.size} total)`,
	);

	// Broadcast status to all browser clients
	broadcast();

	ws.on("close", () => {
		clients.forEach((c) => {
			if (c.ws === ws) clients.delete(c);
		});
		console.log(
			`[-] ${isLaptop ? `Laptop (${name})` : "Browser"} disconnected (${clients.size} total)`,
		);
		broadcast();
	});

	ws.on("error", () => {});
});

function broadcast(): void {
	const laptops = [...clients].filter((c) => c.type === "laptop");
	const payload = JSON.stringify({
		online: laptops.length > 0,
		devices: laptops.length,
		deviceNames: laptops.map((c) => c.name),
		ts: Date.now(),
	});
	clients.forEach(({ ws, type }) => {
		if (type === "browser" && ws.readyState === WebSocket.OPEN) {
			ws.send(payload);
		}
	});
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(
	`  Laptop connects to:  ws://localhost:${PORT}/device?name=<hostname>`,
);
console.log(`  Browser connects to: ws://localhost:${PORT}/status`);
console.log(`  Browser connects to: ws://localhost:${PORT}/status`);
