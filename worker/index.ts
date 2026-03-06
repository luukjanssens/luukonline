import { OnlineStatus } from "./OnlineStatus";

export { OnlineStatus };

interface Env {
	ONLINE_STATUS: DurableObjectNamespace;
	ASSETS: Fetcher;
}

// A simple page any device (phone, tablet) can open to signal "online".
// Visiting /device in a browser loads this; WebSocket upgrades go to the DO.
const DEVICE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>luuk — device</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: monospace;
      background: #0a0a0a;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      gap: 20px;
      user-select: none;
    }
    .dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #333;
      transition: background 0.4s, box-shadow 0.4s;
    }
    .dot.active {
      background: #00ff88;
      box-shadow: 0 0 18px #00ff88;
    }
    .label {
      font-size: 13px;
      color: #555;
      letter-spacing: 0.05em;
    }
    .label.active { color: #00ff88; }
  </style>
</head>
<body>
  <div class="dot" id="dot"></div>
  <span class="label" id="label">connecting…</span>
  <script>
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = proto + '//' + location.host + '/device';
    let ws;

    const proto2 = proto === 'wss:' ? 'WSS (secure)' : 'WS (insecure)';
    console.log('[device] connecting via browser page');
    console.log('[device] connection method:', proto2, '→', url);

    function connect() {
      ws = new WebSocket(url);
      ws.onopen  = () => {
        console.log('[device] connected via', proto2);
        setState(true,  'this device is online');
      };
      ws.onclose = (e) => {
        console.log('[device] disconnected — code:', e.code, 'reason:', e.reason || '(none)');
        setState(false, 'disconnected — retrying…');
        setTimeout(connect, 3000);
      };
      ws.onerror = (e) => {
        console.error('[device] websocket error', e);
        ws.close();
      };
    }

    function setState(on, text) {
      document.getElementById('dot').classList.toggle('active', on);
      const lbl = document.getElementById('label');
      lbl.textContent = text;
      lbl.classList.toggle('active', on);
    }

    // Keep screen awake on mobile if supported
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }

    connect();
  </script>
</body>
</html>`;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/device" || url.pathname === "/status") {
			// Non-WebSocket GET to /device → serve the phone page
			if (
				url.pathname === "/device" &&
				request.headers.get("Upgrade") !== "websocket"
			) {
				return new Response(DEVICE_HTML, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			// Route WebSocket upgrades to the Durable Object
			const id = env.ONLINE_STATUS.idFromName("singleton");
			const stub = env.ONLINE_STATUS.get(id);
			return stub.fetch(request);
		}

		// Everything else: serve the built frontend assets
		return env.ASSETS.fetch(request);
	},
};
