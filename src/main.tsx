import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

console.log(
	`%c
 _                _              _ _            
| |   _   _ _  _| | ___  _ __  | (_)_ __   ___ 
| |  | | | | || | |/ _ \\| '_ \\ | | | '_ \\ / _ \\
| |__| |_| | || | | (_) | | | || | | | | |  __/
|_____\\__,_|\\__,_|_|\\___/|_| |_||_|_|_| |_|\\___|

  👋 hey, you found the console!

  luukonline is forever a work in progress —
  like every website, it's never really done.

  got ideas, suggestions, or just want to say hi?
  HMU →  hi@luukonline.com

`,
	"color: #a78bfa; font-family: monospace; font-size: 12px;",
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
