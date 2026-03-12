/**
 * Returns a WebSocket URL for the given path.
 * Uses VITE_WS_URL as the base when set, so local dev can point at a tunnel
 * or staging URL without touching the build.
 */
export function getWsUrl(path: string): string {
	const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
	if (envUrl) {
		const url = new URL(envUrl);
		url.pathname = path;
		return url.toString();
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${path}`;
}
