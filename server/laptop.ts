import os from "node:os";
import { WebSocket } from "ws";

const BASE_URL =
	process.env.WS_URL ?? "wss://luuk.online/device";
const DEVICE_NAME = process.env.DEVICE_NAME ?? os.hostname();
const WS_URL = `${BASE_URL}?name=${encodeURIComponent(DEVICE_NAME)}`;
const RETRY_DELAY = 5000;

function connect(): void {
	console.log(`[laptop] Connecting as "${DEVICE_NAME}" to ${WS_URL}...`);
	const socket = new WebSocket(WS_URL);

	socket.on("open", () => {
		console.log("[laptop] Connected — you are now online.");
	});

	socket.on("close", () => {
		console.log(`[laptop] Disconnected. Retrying in ${RETRY_DELAY / 1000}s...`);
		setTimeout(connect, RETRY_DELAY);
	});

	socket.on("error", (err: Error) => {
		console.error("[laptop] Error:", err.message);
		socket.terminate();
	});
}

connect();
