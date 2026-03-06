import { useState, useEffect, useRef } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/status";

export function useOnlineStatus() {
  const [status, setStatus] = useState("connecting"); // 'connecting' | 'online' | 'offline'
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  function connect() {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setStatus("connecting"); // wait for first message
      };

      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setStatus(data.online ? "online" : "offline");
      };

      ws.current.onclose = () => {
        setStatus("offline");
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {
      setStatus("offline");
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, []);

  return status;
}
