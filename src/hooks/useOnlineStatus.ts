import { useEffect, useRef, useState } from "react";
import { getWsUrl } from "../utils/ws";

export type OnlineStatus = "connecting" | "online" | "offline";

export interface DeviceInfo {
	name: string;
	connectedAt: number;
}

export interface LastSeen {
	timestamp: number;
	name: string;
}

export interface OnlineStatusResult {
	status: OnlineStatus;
	deviceNames: string[];
	deviceInfo: DeviceInfo[];
	lastSeen: LastSeen | null;
}

export function useOnlineStatus(): OnlineStatusResult {
	const [status, setStatus] = useState<OnlineStatus>("connecting");
	const [deviceNames, setDeviceNames] = useState<string[]>([]);
	const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);
	const [lastSeen, setLastSeen] = useState<LastSeen | null>(null);
	const socket = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttempts = useRef<number>(0);

	useEffect(() => {
		const wsUrl = getWsUrl("/status");

		function connect() {
			try {
				socket.current = new WebSocket(wsUrl);

				socket.current.onopen = () => {
					reconnectAttempts.current = 0;
					setStatus("connecting"); // wait for first message
				};

				socket.current.onmessage = (event: MessageEvent) => {
					const data = JSON.parse(event.data as string) as {
						online: boolean;
						deviceNames?: string[];
						deviceInfo?: DeviceInfo[];
						lastSeen?: LastSeen | null;
					};
					setStatus(data.online ? "online" : "offline");
					setDeviceNames(data.deviceNames ?? []);
					setDeviceInfo(data.deviceInfo ?? []);
					setLastSeen(data.lastSeen ?? null);
				};

				socket.current.onclose = () => {
					reconnectAttempts.current += 1;
					setStatus(reconnectAttempts.current >= 3 ? "offline" : "connecting");
					reconnectTimer.current = setTimeout(connect, 3000);
				};

				socket.current.onerror = (event) => {
					console.error("[status] websocket error", event);
					socket.current?.close();
				};
			} catch (err) {
				console.error("[status] failed to connect:", err);
				reconnectAttempts.current += 1;
				setStatus(reconnectAttempts.current >= 3 ? "offline" : "connecting");
				reconnectTimer.current = setTimeout(connect, 3000);
			}
		}

		connect();
		return () => {
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			socket.current?.close();
		};
	}, []);

	return { status, deviceNames, deviceInfo, lastSeen };
}
