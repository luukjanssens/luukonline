import { WebSocket } from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:8080/laptop";
const RETRY_DELAY = 5000;

function connect(): void {
	console.log(`[laptop] Connecting to ${WS_URL}...`);
	const ws = new WebSocket(WS_URL);

	ws.on("open", () => {
		console.log("[laptop] Connected — you are now online.");
	});

	ws.on("close", () => {
		console.log(`[laptop] Disconnected. Retrying in ${RETRY_DELAY / 1000}s...`);
		setTimeout(connect, RETRY_DELAY);
	});

	ws.on("error", (err: Error) => {
		console.error("[laptop] Error:", err.message);
		ws.terminate();
	});
}

connect();
