import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = process.env.PORT ?? 8080;
const wss = new WebSocketServer({ port: Number(PORT) });

interface Client {
	ws: WebSocket;
	type: "laptop" | "browser";
}

const clients = new Set<Client>();

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
	const isLaptop = req.url === "/laptop";
	const isBrowser = req.url === "/status";

	if (!isLaptop && !isBrowser) {
		ws.close();
		return;
	}

	clients.add({ ws, type: isLaptop ? "laptop" : "browser" });
	console.log(
		`[+] ${isLaptop ? "Laptop" : "Browser"} connected (${clients.size} total)`,
	);

	// Broadcast status to all browser clients
	broadcast();

	ws.on("close", () => {
		clients.forEach((c) => {
			if (c.ws === ws) clients.delete(c);
		});
		console.log(
			`[-] ${isLaptop ? "Laptop" : "Browser"} disconnected (${clients.size} total)`,
		);
		broadcast();
	});

	ws.on("error", () => {});
});

function broadcast(): void {
	const laptopOnline = [...clients].some((c) => c.type === "laptop");
	const payload = JSON.stringify({ online: laptopOnline, ts: Date.now() });
	clients.forEach(({ ws, type }) => {
		if (type === "browser" && ws.readyState === WebSocket.OPEN) {
			ws.send(payload);
		}
	});
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(`  Laptop connects to:  ws://localhost:${PORT}/laptop`);
console.log(`  Browser connects to: ws://localhost:${PORT}/status`);
