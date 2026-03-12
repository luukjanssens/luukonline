import type { OnlineStatus } from "../hooks/useOnlineStatus";

export const STATUS_LABEL: Record<OnlineStatus, string | null> = {
	connecting: null,
	online: "online",
	offline: "offline",
};

export const STATUS_COLORS = {
	dark: { connecting: "#888", online: "#00cc6a", offline: "#e03030" },
	light: { connecting: "#999", online: "#008844", offline: "#cc2020" },
} as const;

export type StatusColorKey = keyof typeof STATUS_COLORS.dark;

export const STATUS_PLACEHOLDER: Record<OnlineStatus, string> = {
	connecting: "...",
	online: "I'm online, let's chat! Click here 🙂",
	offline:
		"I'm currently offline. Leave a message and I'll get back to you when I'm online!",
};
