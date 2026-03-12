export function buildDevicePageHtml(): string {
	return `<!DOCTYPE html>
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
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;

    function detectName() {
      const parameter = new URLSearchParams(location.search).get('name');
      if (parameter) return parameter;
      const userAgent = navigator.userAgent;
      if (/iPad/.test(userAgent)) return 'iPad';
      if (/iPhone/.test(userAgent)) return 'iPhone';
      if (/Android.*Mobile/.test(userAgent)) return 'Android Phone';
      if (/Android/.test(userAgent)) return 'Android Tablet';
      return 'Browser';
    }

    const deviceName = detectName();
    const connectionUrl = protocol + '//' + location.host + '/device?name=' + encodeURIComponent(deviceName);

    console.log('[device] connecting as:', deviceName);
    console.log('[device] url:', connectionUrl);

    function connect() {
      socket = new WebSocket(connectionUrl);
      socket.onopen  = () => {
        console.log('[device] connected');
        setState(true, deviceName + ' is online');
      };
      socket.onclose = (event) => {
        console.log('[device] disconnected — code:', event.code, 'reason:', event.reason || '(none)');
        setState(false, 'disconnected — retrying…');
        setTimeout(connect, 3000);
      };
      socket.onerror = (error) => {
        console.error('[device] websocket error', error);
        socket.close();
      };
    }

    function setState(isOnline, text) {
      document.getElementById('dot').classList.toggle('active', isOnline);
      const labelElement = document.getElementById('label');
      labelElement.textContent = text;
      labelElement.classList.toggle('active', isOnline);
    }

    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }

    connect();
  </script>
</body>
</html>`;
}
