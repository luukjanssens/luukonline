export function formatDuration(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

export function formatLastSeen(timestamp: number): string {
	const date = new Date(timestamp);
	const timeString = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	if (date.toDateString() === new Date().toDateString()) return timeString;
	const dateString = date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
	return `${dateString} at ${timeString}`;
}

export function formatTime(timestamp: number): string {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function generateMessageId(timestamp: number): string {
	return `${timestamp}-${Math.random()}`;
}

const STORAGE_KEY = "chat_session_id";

export function getOrCreateSessionId(): string {
	const existing = localStorage.getItem(STORAGE_KEY);
	if (existing) return existing;
	const id = crypto.randomUUID();
	localStorage.setItem(STORAGE_KEY, id);
	return id;
}

/**
 * Returns a WebSocket URL for the given path.
 * Uses VITE_WS_URL as the base when set (e.g. production URL during local dev),
 * otherwise derives from the current page host.
 */
export function getWsUrl(path: string): string {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${path}`;
}
