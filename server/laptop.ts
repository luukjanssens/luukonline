import os from "node:os";
import { WebSocket } from "ws";

const BASE_URL =
	process.env.WS_URL ?? "wss://luukonline.luuk-online.workers.dev/device";
const DEVICE_NAME = process.env.DEVICE_NAME ?? os.hostname();
const WS_URL = `${BASE_URL}?name=${encodeURIComponent(DEVICE_NAME)}`;
const RETRY_DELAY = 5000;

function connect(): void {
	console.log(`[laptop] Connecting as "${DEVICE_NAME}" to ${WS_URL}...`);
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
