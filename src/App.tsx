import { useDarkMode } from "./hooks/useDarkMode";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import "./global.css";

export default function App() {
	const { status, deviceNames } = useOnlineStatus();
	const [dark, toggleDark] = useDarkMode();
	console.log(deviceNames);
	const statusLabel: Record<string, string> = {
		connecting: "checking...",
		online: "online",
		offline: "offline",
	};

	return (
		<div className="app">
			<p className="line">
				<span className="muted">luuk is </span>
				<span className={`status status--${status}`}>
					<span className="dot" />
					{statusLabel[status]}
				</span>
			</p>
			{deviceNames.length > 0 ? (
				<p className="line">
					<span className="muted">via </span>
					<span className="device-names">{deviceNames.join(", ")}</span>
				</p>
			) : (
				"joe"
			)}
			<button type="button" className="theme-toggle" onClick={toggleDark}>
				{dark ? "light" : "dark"}
			</button>
		</div>
	);
}
