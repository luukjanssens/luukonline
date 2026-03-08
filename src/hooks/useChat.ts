import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
	id: string;
	from: "visitor" | "luuk";
	text: string;
	timestamp: number;
}

export interface UseChatResult {
	messages: ChatMessage[];
	connected: boolean;
	send: (text: string) => void;
}

// Derive chat WS URL the same way useOnlineStatus does: prefer VITE_WS_URL
// (replacing the path with /chat) so local dev hits the real backend.
const _wsBase = import.meta.env.VITE_WS_URL as string | undefined;
const CHAT_URL = _wsBase
	? _wsBase.replace(/\/[^/]+$/, "/chat")
	: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/chat`;

export function useChat(): UseChatResult {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const url = CHAT_URL;

		function connect() {
			const ws = new WebSocket(url);
			socketRef.current = ws;

			ws.onopen = () => setConnected(true);

			ws.onmessage = (e: MessageEvent) => {
				const data = JSON.parse(e.data as string) as {
					type: string;
					from?: "visitor" | "luuk";
					text?: string;
					timestamp?: number;
				};

				if (data.type === "message" && data.from && data.text) {
					setMessages((prev) => [
						...prev,
						{
							id: `${data.timestamp ?? Date.now()}-${Math.random()}`,
							from: data.from as "visitor" | "luuk",
							text: data.text as string,
							timestamp: data.timestamp ?? Date.now(),
						},
					]);
				}

				if (data.type === "location_request") {
					navigator.geolocation?.getCurrentPosition(
						(pos) => {
							if (ws.readyState === WebSocket.OPEN) {
								ws.send(JSON.stringify({
									type: "location",
									lat: pos.coords.latitude,
									lon: pos.coords.longitude,
									accuracy: pos.coords.accuracy,
								}));
								setMessages((prev) => [
									...prev,
									{
										id: `${Date.now()}-location`,
										from: "visitor" as const,
										text: "📍 location shared",
										timestamp: Date.now(),
									},
								]);
							}
						},
						() => {
							if (ws.readyState === WebSocket.OPEN) {
								ws.send(JSON.stringify({ type: "location_denied" }));
							}
						},
					);
				}
			};

			ws.onclose = () => {
				setConnected(false);
				reconnectTimer.current = setTimeout(connect, 3000);
			};

			ws.onerror = () => ws.close();
		}

		connect();

		return () => {
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			socketRef.current?.close();
		};
	}, []);

	const send = useCallback((text: string) => {
		const ws = socketRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "message", text }));
		}
	}, []);

	return { messages, connected, send };
}
