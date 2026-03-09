/**
 * Returns a WebSocket URL for the given path.
 * Uses VITE_WS_URL as the base when set (swapping its path segment), so local
 * dev can point at a tunnel or staging URL without touching the build.
 */
export function getWsUrl(path: string): string {
	const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
	if (envUrl) {
		return envUrl.replace(/\/[^/]*$/, path);
	}
	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${window.location.host}${path}`;
}
