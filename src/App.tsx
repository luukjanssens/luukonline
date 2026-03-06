import type { CSSProperties } from "react";
import { AsciiRenderer } from "./components/AsciiRenderer";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import "./App.css";

export default function App() {
	const status = useOnlineStatus();

	const statusLabel: Record<string, string> = {
		connecting: "checking...",
		online: "online",
		offline: "offline",
	};

	const statusColor: Record<string, string> = {
		connecting: "#888888",
		online: "#00ff88",
		offline: "#ff3333",
	};

	return (
		<div className="app">
			<header className="header">
				<span className="name">luuk janssens</span>
				<div
					className="status-badge"
					style={{ "--color": statusColor[status] } as CSSProperties}
				>
					<span className="status-dot" />
					<span className="status-text">{statusLabel[status]}</span>
				</div>
			</header>

			<div className="canvas-area">
				<AsciiRenderer online={status} />
			</div>

			<footer className="footer">
				<span>drag to rotate · scroll to zoom</span>
			</footer>
		</div>
	);
}
