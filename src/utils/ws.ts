function localWsUrl(path: string): string {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${path}`;
}

/**
 * Returns the WebSocket URL for the status endpoint.
 * Uses VITE_STATUS_WS_URL when set (e.g. prod URL during local dev).
 */
export function getStatusWsUrl(): string {
	const envUrl = import.meta.env.VITE_STATUS_WS_URL as string | undefined;
	if (envUrl) {
		const url = new URL(envUrl);
		url.pathname = "/status";
		return url.toString();
	}
	return localWsUrl("/status");
}

/**
 * Returns the WebSocket URL for the chat endpoint.
 * Always uses window.location.host so local dev hits the local worker.
 */
export function getChatWsUrl(): string {
	return localWsUrl("/chat");
}
