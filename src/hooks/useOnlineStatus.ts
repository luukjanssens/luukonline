import { useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/status";

export type OnlineStatus = "connecting" | "online" | "offline";

export function useOnlineStatus(): OnlineStatus {
	const [status, setStatus] = useState<OnlineStatus>("connecting");
	const ws = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		function connect() {
			try {
				ws.current = new WebSocket(WS_URL);

				ws.current.onopen = () => {
					setStatus("connecting"); // wait for first message
				};

				ws.current.onmessage = (e: MessageEvent) => {
					const data = JSON.parse(e.data as string) as { online: boolean };
					setStatus(data.online ? "online" : "offline");
				};

				ws.current.onclose = () => {
					setStatus("offline");
					reconnectTimer.current = setTimeout(connect, 3000);
				};

				ws.current.onerror = () => {
					ws.current?.close();
				};
			} catch {
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

	return status;
}
