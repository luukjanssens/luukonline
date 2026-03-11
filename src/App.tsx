import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useHighContrast } from "./hooks/useHighContrast";
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
		return deviceNames.map((name) => ({
			key: name,
			text: `/ ${name}`,
			pillText: name,
		}));
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
	const [highContrast, toggleHighContrast] = useHighContrast();
	const [contrastRotation, setContrastRotation] = useState(0);
	const [now, setNow] = useState(Date.now());
	const [isExpanded, setIsExpanded] = useState(false);
	const [expandCount, setExpandCount] = useState(0);
	const [chatStarted, setChatStarted] = useState(false);
	const [pillHeaderHeight, setPillHeaderHeight] = useState(0);
	const pillFromYRef = useRef(0);
	const groupRef = useRef<HTMLButtonElement>(null);
	const pillHeaderRef = useRef<HTMLDivElement>(null);

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

	useLayoutEffect(() => {
		if (!chatStarted || !pillHeaderRef.current) return;
		const element = pillHeaderRef.current;
		const fromY = pillFromYRef.current;
		const animation = element.animate(
			[{ transform: `translateY(${fromY}px)` }, { transform: "translateY(0)" }],
			{
				duration: 400,
				easing: "cubic-bezier(0.22, 1, 0.36, 1)",
				fill: "forwards",
			},
		);
		animation.finished.then(() => animation.cancel());
		return () => animation.cancel();
	}, [chatStarted]);

	const deviceItems = getDeviceItems(deviceInfo, deviceNames, lastSeen, now);
	const statusColor =
		statusColors[dark ? "dark" : "light"][status as StatusColorKey] ??
		"inherit";

	return (
		<div className="h-dvh flex flex-col items-center justify-center gap-4 md:gap-6">
			<div
				ref={pillHeaderRef}
				className={`flex flex-col items-center w-full${chatStarted ? " fixed top-0 left-0 right-0 z-50 sticky-header" : ""}`}
			>
				<div
					className={`flex w-full items-center justify-center${chatStarted ? " pt-3 pb-3" : " pt-6 md:pt-10"}`}
				>
					<p className="text-sm font-light tracking-wider md:tracking-widest lowercase whitespace-nowrap flex">
						<button
							type="button"
							ref={groupRef}
							className="status-pill relative group inline-flex items-center gap-2 touch-manipulation border-0 rounded-full px-3.5 py-2 md:px-5 md:py-2.5 font-[inherit] text-[length:inherit] tracking-[inherit] lowercase hover:cursor-pointer"
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
						</button>
					</p>
				</div>

				{/* Device pills that drop down and push the chat */}
				{deviceItems.length > 0 && (
					<div
						className="grid w-full overflow-hidden"
						style={{
							gridTemplateRows: isExpanded ? "1fr" : "0fr",
							transition: isExpanded
								? "grid-template-rows 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
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
											animationDuration: "0.45s",
											animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
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
			<div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 flex items-center gap-3 md:gap-4">
				<button
					type="button"
					className="cursor-pointer border-0 bg-transparent p-0 text-inherit transition-transform duration-300"
					style={{ transform: `rotate(${contrastRotation}deg)` }}
					onClick={() => {
						setContrastRotation((rotation) => rotation + 180);
						toggleHighContrast();
					}}
					aria-label={
						highContrast ? "Disable high contrast" : "Enable high contrast"
					}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<path
							d="M12 18a6 6 0 0 0 0-12v12z"
							fill="currentColor"
							stroke="none"
						/>
					</svg>
				</button>
				<button
					type="button"
					className="cursor-pointer border-0 bg-transparent p-0 text-inherit"
					onClick={toggleDark}
					aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
				>
					{dark ? (
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
							<path d="M12 2v2" />
							<path d="M12 20v2" />
							<path d="m4.93 4.93 1.41 1.41" />
							<path d="m17.66 17.66 1.41 1.41" />
							<path d="M2 12h2" />
							<path d="M20 12h2" />
							<path d="m6.34 17.66-1.41 1.41" />
							<path d="m19.07 4.93-1.41 1.41" />
						</svg>
					) : (
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path
								d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401z"
								fill="currentColor"
								stroke="none"
							/>
						</svg>
					)}
				</button>
			</div>
			{chatStarted && <div style={{ height: pillHeaderHeight }} aria-hidden />}
			<Chat
				placeholder={statusPlaceholder[status]}
				onChatStart={() => {
					if (!pillHeaderRef.current) return;
					const rect = pillHeaderRef.current.getBoundingClientRect();
					pillFromYRef.current = rect.top;
					setPillHeaderHeight(rect.height);
					setChatStarted(true);
				}}
			/>
		</div>
	);
}
