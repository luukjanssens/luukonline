import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

console.log(
	`%c
    __            __                ___
   / /_  ____  __/ /__ ____  ____  / (_)___  ___
  / / / / / / / / //_// __ \\/ __ \\/ / / __ \\/ _ \\
 / / /_/ / /_/ / ,< _/ /_/ / / / / / / / / /  __/
/_/\\__,_/\\__,_/_/|_(_)____/_/ /_/_/_/_/ /_/\\___/

  👋 hey, you found the console!

  luuk.online is forever work in progress —
  it's never really done.

  got ideas, suggestions, or just want to say hallo?
  HMU →  halloÌ@luukjanssens.nl

`,
	"color: #a78bfa; font-family: monospace; font-size: 12px;",
);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);
