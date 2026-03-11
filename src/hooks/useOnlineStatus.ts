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

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_BEFORE_OFFLINE = 3;

export function useOnlineStatus(): OnlineStatusResult {
	const [status, setStatus] = useState<OnlineStatus>("connecting");
	const [deviceNames, setDeviceNames] = useState<string[]>([]);
	const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);
	const [lastSeen, setLastSeen] = useState<LastSeen | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttempts = useRef<number>(0);

	useEffect(() => {
		const wsUrl = getWsUrl("/status");

		function connect() {
			try {
				const socket = new WebSocket(wsUrl);
				socketRef.current = socket;

				socket.onopen = () => {
					reconnectAttempts.current = 0;
					setStatus("connecting"); // wait for first message
				};

				socket.onmessage = (event: MessageEvent) => {
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

				socket.onclose = () => {
					reconnectAttempts.current += 1;
					setStatus(
						reconnectAttempts.current >= MAX_RECONNECT_BEFORE_OFFLINE
							? "offline"
							: "connecting",
					);
					reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
				};

				socket.onerror = (error) => {
					console.error("[status] websocket error", error);
					socket.close();
				};
			} catch (error) {
				console.error("[status] failed to connect:", error);
				reconnectAttempts.current += 1;
				setStatus(
					reconnectAttempts.current >= MAX_RECONNECT_BEFORE_OFFLINE
						? "offline"
						: "connecting",
				);
				reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
			}
		}

		connect();
		return () => {
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			socketRef.current?.close();
		};
	}, []);

	return { status, deviceNames, deviceInfo, lastSeen };
}
