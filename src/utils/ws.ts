/**
 * Returns a WebSocket URL for the given path.
 * Uses VITE_WS_URL as the base when set (e.g. production URL during local dev),
 * otherwise derives from the current page host.
 */
function getWsUrl(path: string): string {
	const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
	if (envUrl) {
		const url = new URL(envUrl);
		url.pathname = path;
		return url.toString();
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${path}`;
}

export function getStatusWsUrl(): string {
	return getWsUrl("/status");
}

export function getChatWsUrl(): string {
	return getWsUrl("/chat");
}
