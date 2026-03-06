import { useEffect, useRef, useState } from "react";

// Derive WS URL from the current page host so it works both locally and in
// production without baking a hardcoded URL into the bundle.
// Override with VITE_WS_URL only when explicitly needed (e.g. a tunnel URL).
const WS_URL =
	import.meta.env.VITE_WS_URL ||
	`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/status`;

export type OnlineStatus = "connecting" | "online" | "offline";

export interface DeviceInfo {
	name: string;
	connectedAt: number;
}

export interface OnlineStatusResult {
	status: OnlineStatus;
	deviceNames: string[];
	deviceInfo: DeviceInfo[];
}

export function useOnlineStatus(): OnlineStatusResult {
	const [status, setStatus] = useState<OnlineStatus>("connecting");
	const [deviceNames, setDeviceNames] = useState<string[]>([]);
	const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);
	const ws = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const wsProto = WS_URL.startsWith("wss:")
			? "WSS (secure)"
			: "WS (insecure)";
		console.log("[status] connecting as:", navigator.userAgent);
		console.log("[status] connection method:", wsProto, "→", WS_URL);

		function connect() {
			try {
				ws.current = new WebSocket(WS_URL);

				ws.current.onopen = () => {
					console.log("[status] connected via", wsProto);
					setStatus("connecting"); // wait for first message
				};

				ws.current.onmessage = (e: MessageEvent) => {
					const data = JSON.parse(e.data as string) as {
						online: boolean;
						deviceNames?: string[];
						deviceInfo?: DeviceInfo[];
					};
					console.log("[status] received:", data);
					setStatus(data.online ? "online" : "offline");
					setDeviceNames(data.deviceNames ?? []);
					setDeviceInfo(data.deviceInfo ?? []);
				};

				ws.current.onclose = (e) => {
					console.log(
						"[status] disconnected — code:",
						e.code,
						"reason:",
						e.reason || "(none)",
					);
					setStatus("offline");
					reconnectTimer.current = setTimeout(connect, 3000);
				};

				ws.current.onerror = (e) => {
					console.error("[status] websocket error", e);
					ws.current?.close();
				};
			} catch (err) {
				console.error("[status] failed to connect:", err);
				setStatus("offline");
				reconnectTimer.current = setTimeout(connect, 3000);
			}
		}

		connect();
		return () => {
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			ws.current?.close();
		};
	}, []);

	return { status, deviceNames, deviceInfo };
}
