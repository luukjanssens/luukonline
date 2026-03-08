import os from "node:os";
import { WebSocket } from "ws";

function timestamp(): string {
	return new Date().toISOString();
}

const BASE_URL = process.env.WS_URL ?? "wss://luuk.online/device";
const DEVICE_NAME = process.env.DEVICE_NAME ?? os.hostname();
const WS_URL = `${BASE_URL}?name=${encodeURIComponent(DEVICE_NAME)}`;
const RETRY_DELAY = 5000;
const PING_INTERVAL = 30_000;
const PONG_TIMEOUT = 10_000;

let activeSocket: WebSocket | null = null;

function connect(): void {
	console.log(
		`${timestamp()} [laptop] Connecting as "${DEVICE_NAME}" to ${WS_URL}...`,
	);
	const socket = new WebSocket(WS_URL);
	activeSocket = socket;
	let pingTimer: ReturnType<typeof setInterval> | null = null;
	let pongTimer: ReturnType<typeof setTimeout> | null = null;

	function stopTimers() {
		if (pingTimer) clearInterval(pingTimer);
		if (pongTimer) clearTimeout(pongTimer);
		pingTimer = null;
		pongTimer = null;
	}

	socket.on("open", () => {
		console.log(`${timestamp()} [laptop] Connected — you are now online.`);
		pingTimer = setInterval(() => {
			if (socket.readyState !== WebSocket.OPEN) return;
			socket.ping();
			pongTimer = setTimeout(() => {
				console.warn(`${timestamp()} [laptop] Pong timeout — reconnecting...`);
				socket.terminate();
			}, PONG_TIMEOUT);
		}, PING_INTERVAL);
	});

	socket.on("pong", () => {
		if (pongTimer) clearTimeout(pongTimer);
		pongTimer = null;
	});

	socket.on("close", () => {
		stopTimers();
		activeSocket = null;
		console.log(
			`${timestamp()} [laptop] Disconnected. Retrying in ${RETRY_DELAY / 1000}s...`,
		);
		setTimeout(connect, RETRY_DELAY);
	});

	socket.on("error", (err: Error) => {
		console.error(`${timestamp()} [laptop] Error:`, err.message);
		socket.terminate();
	});
}

process.on("SIGTERM", () => {
	console.log(`${timestamp()} [laptop] SIGTERM received — closing connection.`);
	if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
		activeSocket.close(1001, "Going away");
	}
	process.exit(0);
});

connect();
