import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { AsciiRenderer } from "./components/AsciiRenderer";
import "./App.css";

export default function App() {
  const status = useOnlineStatus();

  const statusLabel = {
    connecting: "checking...",
    online: "online",
    offline: "offline",
  }[status];

  const statusColor = {
    connecting: "#888888",
    online: "#00ff88",
    offline: "#ff3333",
  }[status];

  return (
    <div className="app">
      <header className="header">
        <span className="name">luuk janssens</span>
        <div className="status-badge" style={{ "--color": statusColor }}>
          <span className="status-dot" />
          <span className="status-text">{statusLabel}</span>
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
