import { useEffect, useState } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import "./global.css";

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

function formatLastSeen(timestamp: number): string {
	const date = new Date(timestamp);
	const timeStr = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
	if (date.toDateString() === new Date().toDateString()) return timeStr;
	const dateStr = date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
	return `${dateStr} at ${timeStr}`;
}

const statusLabel: Record<string, string> = {
	connecting: "checking...",
	online: "online",
	offline: "offline",
};

const statusColors = {
	dark: { connecting: "#888", online: "#00cc6a", offline: "#e03030" },
	light: { connecting: "#999", online: "#008844", offline: "#cc2020" },
};

export default function App() {
	const { status, deviceNames, deviceInfo, lastSeen } = useOnlineStatus();
	const [dark, toggleDark] = useDarkMode();
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (deviceInfo.length === 0) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [deviceInfo.length]);

	const statusColor =
		statusColors[dark ? "dark" : "light"][
			status as keyof (typeof statusColors)["dark"]
		] ?? "inherit";

	return (
		<div className="relative flex h-full w-full items-center justify-center">
			<p className="relative text-sm font-light tracking-widest lowercase whitespace-nowrap flex">
				<div className="hover:cursor-pointer group flex gap-2">
					<span className="opacity-50">luuk is</span>
					<span
						className="inline-flex items-center gap-2 transition-colors duration-600"
						style={{ color: statusColor }}
					>
						<span className="inline-block size-1.5 shrink-0 rounded-full bg-current animate-pulse-dot shadow-sm mt-0.5" />
						{statusLabel[status]}
					</span>
					{deviceNames.length > 0 && (
						<span className="absolute left-full ml-5 opacity-0 group-hover:opacity-20 -translate-x-1 group-hover:translate-x-0 transition duration-300 whitespace-nowrap">
							{deviceInfo.length > 0
								? deviceInfo
										.map(
											(device) =>
												`/ ${device.name} (${formatDuration(now - device.connectedAt)})`,
										)
										.join(", ")
								: deviceNames.join(", ")}
						</span>
					)}
				</div>
				{status === "offline" && lastSeen && (
					<span className="absolute left-full opacity-0 group-hover:opacity-20 -translate-x-1 group-hover:translate-x-0 transition duration-300 whitespace-nowrap">
						last seen on {lastSeen.name} at {formatLastSeen(lastSeen.timestamp)}
					</span>
				)}
			</p>
			<button
				type="button"
				className="absolute right-7 bottom-6 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs tracking-widest lowercase text-inherit opacity-30 transition-opacity duration-200 hover:opacity-70"
				onClick={toggleDark}
			>
				{dark ? "light" : "dark"}
			</button>
		</div>
	);
}
