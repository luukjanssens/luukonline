import { useEffect, useRef, useState } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import {
	type DeviceInfo,
	type LastSeen,
	type OnlineStatus,
	useOnlineStatus,
} from "./hooks/useOnlineStatus";
import "./global.css";
import { Chat } from "./Chat";

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
	const timeString = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	if (date.toDateString() === new Date().toDateString()) return timeString;
	const dateString = date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
	return `${dateString} at ${timeString}`;
}

const statusLabel: Record<OnlineStatus, string> = {
	connecting: "checking...",
	online: "online",
	offline: "offline",
};

const statusColors = {
	dark: { connecting: "#888", online: "#00cc6a", offline: "#e03030" },
	light: { connecting: "#999", online: "#008844", offline: "#cc2020" },
};

const statusPlaceholder: Record<OnlineStatus, string> = {
	connecting: "...",
	online: "I'm online! Let's chat!",
	offline:
		"I'm currently offline. Leave a message and I'll get back to you when I'm online!",
};

type StatusColorKey = keyof typeof statusColors.dark;

function getDeviceItems(
	deviceInfo: DeviceInfo[],
	deviceNames: string[],
	lastSeen: LastSeen | null,
	now: number,
) {
	if (deviceInfo.length > 0) {
		const seen = new Set<string>();
		const deduped = [...deviceInfo]
			.sort((a, b) => a.connectedAt - b.connectedAt)
			.filter((device) => !seen.has(device.name) && seen.add(device.name));
		return deduped.map((device) => ({
			key: device.name,
			text: `/ ${device.name} (${formatDuration(now - device.connectedAt)})`,
			pillText: `${device.name} · ${formatDuration(now - device.connectedAt)}`,
		}));
	}
	if (deviceNames.length > 0)
		return deviceNames.map((name) => ({ key: name, text: `/ ${name}`, pillText: name }));
	if (lastSeen)
		return [
			{
				key: "lastSeen",
				text: `/ last seen on ${lastSeen.name} at ${formatLastSeen(lastSeen.timestamp)}`,
				pillText: `last seen · ${lastSeen.name}`,
			},
		];
	return [];
}

export default function App() {
	const { status, deviceNames, deviceInfo, lastSeen } = useOnlineStatus();
	const [dark, toggleDark] = useDarkMode();
	const [now, setNow] = useState(Date.now());
	const [isExpanded, setIsExpanded] = useState(false);
	const [expandCount, setExpandCount] = useState(0);
	const groupRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (deviceInfo.length === 0) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [deviceInfo.length]);

	useEffect(() => {
		if (!isExpanded) return;
		const handler = (e: MouseEvent) => {
			if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
				setIsExpanded(false);
			}
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}, [isExpanded]);

	const deviceItems = getDeviceItems(deviceInfo, deviceNames, lastSeen, now);
	const statusColor =
		statusColors[dark ? "dark" : "light"][status as StatusColorKey] ??
		"inherit";

	return (
		<div className="h-dvh flex flex-col items-center justify-center gap-6">
			<div className="flex flex-col items-center w-full">
				<div className="flex w-full items-center justify-center pt-10">
					<p className="text-sm font-light tracking-widest lowercase whitespace-nowrap flex">
						<button
							type="button"
							ref={groupRef}
							className="status-pill relative group inline-flex items-center gap-2 touch-manipulation border-0 rounded-full px-5 py-2.5 font-[inherit] text-[length:inherit] tracking-[inherit] lowercase hover:cursor-pointer"
							data-expanded={isExpanded ? "" : undefined}
							onClick={() =>
								setIsExpanded((expanded) => {
									if (!expanded) setExpandCount((count) => count + 1);
									return !expanded;
								})
							}
						>
							<span className="opacity-50">luuk is</span>
							<span
								className="inline-flex items-center gap-2 transition-colors duration-600"
								style={{ color: statusColor }}
							>
								<span className="inline-block size-1.5 shrink-0 rounded-full bg-current animate-pulse-dot shadow-sm mt-0.5" />
								{statusLabel[status]}
							</span>
							{/* Mobile: text labels below the pill */}
							{deviceItems.length > 0 && (
								<span className="absolute top-full left-0 mt-1 flex flex-col md:hidden">
									{deviceItems.map((item, index) => (
										<span
											key={item.key}
											className="whitespace-nowrap text-[0.8em] opacity-0 translate-y-1 group-data-expanded:opacity-20 group-data-expanded:translate-y-0 transition duration-300"
											style={{ transitionDelay: `${index * 60}ms` }}
										>
											{item.text}
										</span>
									))}
								</span>
							)}
						</button>
					</p>
					<button
						type="button"
						className="absolute right-7 bottom-6 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs tracking-widest lowercase text-inherit opacity-30 transition-opacity duration-200 hover:opacity-70"
						onClick={toggleDark}
					>
						{dark ? "light" : "dark"}
					</button>
				</div>

				{/* Desktop: device pills that drop down and push the chat */}
				{deviceItems.length > 0 && (
					<div
						className="hidden md:grid w-full overflow-hidden"
						style={{
							gridTemplateRows: isExpanded ? "1fr" : "0fr",
							transition: isExpanded
								? "grid-template-rows 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
								: "grid-template-rows 0.28s cubic-bezier(0.6, 0, 0.8, 0)",
						}}
					>
						<div className="min-h-0 overflow-hidden">
							<div className="flex justify-center gap-3 pt-3 pb-2">
								{deviceItems.map((item, index) => (
									<span
										key={`${item.key}-${expandCount}`}
										className="device-pill inline-flex items-center px-4 py-1 text-xs font-light tracking-widest lowercase whitespace-nowrap rounded-full"
										style={{
											animationName: "device-pill-pop",
											animationDuration: "0.55s",
											animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
											animationDelay: `${index * 80}ms`,
											animationFillMode: "both",
										}}
									>
										{item.pillText}
									</span>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
			<Chat placeholder={statusPlaceholder[status]} />
		</div>
	);
}
