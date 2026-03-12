import { useCallback, useEffect, useRef, useState } from "react";
import { generateMessageId, getOrCreateSessionId, getWsUrl } from "../utils";

export interface ChatMessage {
	id: string;
	from: "visitor" | "luuk";
	text: string;
	timestamp: number;
	read?: boolean;
}

export interface UseChatResult {
	messages: ChatMessage[];
	connected: boolean;
	send: (text: string) => void;
	hasHistory: boolean;
	newMessageCount: number;
	blocked: boolean;
	rateLimited: boolean;
}

const RECONNECT_DELAY = 3000;

export function useChat(): UseChatResult {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [connected, setConnected] = useState(false);
	const [hasHistory, setHasHistory] = useState(false);
	const [newMessageCount, setNewMessageCount] = useState(0);
	const [blocked, setBlocked] = useState(false);
	const [rateLimited, setRateLimited] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rateLimitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const chatUrl = getWsUrl("/chat");

		function connect() {
			const socket = new WebSocket(
				`${chatUrl}?sessionId=${getOrCreateSessionId()}`,
			);
			socketRef.current = socket;

			socket.onopen = () => setConnected(true);

			socket.onmessage = (event: MessageEvent) => {
				let data: {
					type: string;
					from?: "visitor" | "luuk";
					text?: string;
					timestamp?: number;
					messages?: Array<{
						from: "visitor" | "luuk";
						text: string;
						timestamp: number;
					}>;
				};
				try {
					data = JSON.parse(event.data as string);
				} catch {
					return;
				}
				if (typeof data?.type !== "string") return;

				if (data.type === "history" && Array.isArray(data.messages)) {
					const lastSeenTimestamp = Number(
						localStorage.getItem("chat_last_seen_at") ?? "0",
					);
					const mapped: ChatMessage[] = data.messages.map((entry) => ({
						id: `hist-${generateMessageId(entry.timestamp)}`,
						from: entry.from,
						text: entry.text,
						timestamp: entry.timestamp,
						read: true,
					}));
					const unseenCount = data.messages.filter(
						(entry) =>
							entry.from === "luuk" && entry.timestamp > lastSeenTimestamp,
					).length;
					setMessages(mapped);
					setHasHistory(true);
					setNewMessageCount(unseenCount);
				}

				if (data.type === "message" && data.from && data.text) {
					const { from, text, timestamp } = data;
					setMessages((previousMessages) => {
						const updated =
							from === "luuk"
								? previousMessages.map((message) =>
										message.from === "visitor"
											? { ...message, read: true }
											: message,
									)
								: previousMessages;
						return [
							...updated,
							{
								id: generateMessageId(timestamp ?? Date.now()),
								from,
								text,
								timestamp: timestamp ?? Date.now(),
							},
						];
					});
				}

				if (data.type === "rate_limited") {
					setRateLimited(true);
					if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
					rateLimitTimer.current = setTimeout(
						() => setRateLimited(false),
						2000,
					);
				}

				if (data.type === "location_request") {
					navigator.geolocation?.getCurrentPosition(
						(position) => {
							if (socket.readyState === WebSocket.OPEN) {
								socket.send(
									JSON.stringify({
										type: "location",
										lat: position.coords.latitude,
										lon: position.coords.longitude,
										accuracy: position.coords.accuracy,
									}),
								);
								setMessages((previousMessages) => [
									...previousMessages,
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
							if (socket.readyState === WebSocket.OPEN) {
								socket.send(JSON.stringify({ type: "location_denied" }));
							}
						},
					);
				}
			};

			socket.onclose = (event: CloseEvent) => {
				localStorage.setItem("chat_last_seen_at", String(Date.now()));
				setConnected(false);
				if (event.code === 4403) {
					setBlocked(true);
					return;
				}
				reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
			};

			socket.onerror = () => socket.close();
		}

		connect();

		return () => {
			if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
			if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
			socketRef.current?.close();
		};
	}, []);

	const send = useCallback((text: string) => {
		const socket = socketRef.current;
		if (socket?.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: "message", text }));
		}
	}, []);

	return {
		messages,
		connected,
		send,
		hasHistory,
		newMessageCount,
		blocked,
		rateLimited,
	};
}
