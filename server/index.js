import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

wss.on("connection", (ws, req) => {
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

function broadcast() {
	const laptopOnline = [...clients].some((c) => c.type === "laptop");
	const payload = JSON.stringify({ online: laptopOnline, ts: Date.now() });
	clients.forEach(({ ws, type }) => {
		if (type === "browser" && ws.readyState === 1) {
			ws.send(payload);
		}
	});
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(`  Laptop connects to:  ws://localhost:${PORT}/laptop`);
console.log(`  Browser connects to: ws://localhost:${PORT}/status`);
