# luuk.online

A minimal website showing whether Luuk is online or not, with an ASCII-rendered 3D object.

## How it works

- **Your laptop** runs a small WebSocket server (`server/`)
- **Cloudflare Tunnel** exposes it publicly without needing a hosted server
- **The website** connects via WebSocket — if the server is up, you're online. If not, offline.

---

## Setup

### 1. Install Cloudflare Tunnel

```bash
brew install cloudflared
```

### 2. Start the WebSocket server on your laptop

```bash
cd server
npm install
node index.js
```

### 3. Expose it with Cloudflare Tunnel

For a **permanent fixed URL** (recommended):
```bash
cloudflared tunnel login
cloudflared tunnel create luukonline
cloudflared tunnel route dns luukonline ws.yourdomain.com
cloudflared tunnel run luukonline
```

Then update `.env.local`:
```
VITE_WS_URL=wss://ws.yourdomain.com/status
```

### 4. Run the frontend

```bash
npm install
cp .env.example .env.local
npm run dev
```

### 5. Deploy

```bash
npm run build
# deploy /dist to Vercel, Netlify, or GitHub Pages
```
