import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Chat } from "./Chat";
import { CheckingText } from "./components/CheckingText";
import { DeviceDropdown, type DeviceItem } from "./components/DeviceDropdown";
import { StatusText } from "./components/StatusText";
import { ThemeControls } from "./components/ThemeControls";
import {
	STATUS_COLORS,
	STATUS_LABEL,
	STATUS_PLACEHOLDER,
	type StatusColorKey,
} from "./constants/status";
import "./global.css";
import { useDarkMode } from "./hooks/useDarkMode";
import { useHighContrast } from "./hooks/useHighContrast";
import {
	type DeviceInfo,
	type LastSeen,
	useOnlineStatus,
} from "./hooks/useOnlineStatus";
import { formatDuration, formatLastSeen } from "./utils";

function getDeviceItems(
	deviceInfo: DeviceInfo[],
	deviceNames: string[],
	lastSeen: LastSeen | null,
	now: number,
): DeviceItem[] {
	if (deviceInfo.length > 0) {
		const seen = new Set<string>();
		const deduped = [...deviceInfo]
			.sort((first, second) => first.connectedAt - second.connectedAt)
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
	const [now, setNow] = useState(Date.now());
	const [isExpanded, setIsExpanded] = useState(false);
	const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
	const [chatStarted, setChatStarted] = useState(false);
	const [pillHeaderHeight, setPillHeaderHeight] = useState(0);
	const pillFromYRef = useRef(0);
	const groupRef = useRef<HTMLButtonElement>(null);
	const pillHeaderRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (deviceInfo.length === 0) return;
		const intervalId = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(intervalId);
	}, [deviceInfo.length]);

	useEffect(() => {
		if (!isExpanded) return;
		const handler = (event: MouseEvent) => {
			if (
				groupRef.current &&
				!groupRef.current.contains(event.target as Node)
			) {
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
	const visibleDeviceItems = deviceItems.filter(
		(item) => !dismissedKeys.has(item.key),
	);

	const statusColor =
		STATUS_COLORS[dark ? "dark" : "light"][status as StatusColorKey] ??
		"inherit";

	return (
		<div className="h-dvh flex flex-col items-center justify-center gap-4 md:gap-6">
			<div
				ref={pillHeaderRef}
				className={`flex flex-col items-center w-full${chatStarted ? " fixed top-0 left-0 right-0 z-50 sticky-header" : ""}`}
			>
				<div
					className={`flex w-full items-center justify-center${chatStarted ? " pt-3" : " pt-6 md:pt-10"}`}
				>
					<p className="text-sm font-light tracking-wider md:tracking-widest lowercase whitespace-nowrap flex">
						<motion.button
							layout="size"
							transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
							type="button"
							ref={groupRef}
							className="status-pill relative group inline-flex items-center gap-2 touch-manipulation border-0 rounded-full px-3.5 py-2 md:px-5 md:py-2.5 font-[inherit] text-[length:inherit] tracking-[inherit] lowercase hover:cursor-pointer"
							data-expanded={isExpanded ? "" : undefined}
							aria-label={`luuk is ${STATUS_LABEL[status] ?? "checking"}${
								deviceItems.length > 0
									? ` — click to ${isExpanded ? "hide" : "show"} devices`
									: ""
							}`}
							aria-expanded={deviceItems.length > 0 ? isExpanded : undefined}
							onClick={() => {
								if (!isExpanded) setDismissedKeys(new Set());
								setIsExpanded((expanded) => !expanded);
							}}
						>
							{status === "connecting" ? (
								<CheckingText />
							) : (
								<StatusText
									key={status}
									status={status}
									statusColor={statusColor}
								/>
							)}
						</motion.button>
					</p>
				</div>

				<DeviceDropdown
					deviceItems={visibleDeviceItems}
					isExpanded={isExpanded}
				/>
			</div>

			<ThemeControls
				dark={dark}
				toggleDark={toggleDark}
				highContrast={highContrast}
				toggleHighContrast={toggleHighContrast}
			/>

			{chatStarted && <div style={{ height: pillHeaderHeight }} aria-hidden />}
			<Chat
				placeholder={STATUS_PLACEHOLDER[status]}
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
