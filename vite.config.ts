import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [tailwindcss(), react()],
	server: {
		proxy: {
			// Forward /chat WebSocket to the local wrangler dev worker.
			// Status WS goes directly to production via VITE_STATUS_WS_URL (.env.local).
			"/chat": {
				target: "http://localhost:8787",
				ws: true,
			},
		},
	},
});
