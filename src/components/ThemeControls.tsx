export function ThemeControls({
	dark,
	toggleDark,
	highContrast,
	toggleHighContrast,
}: {
	dark: boolean;
	toggleDark: () => void;
	highContrast: boolean;
	toggleHighContrast: () => void;
}) {
	return (
		<div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 flex items-center gap-3 md:gap-4">
			<ContrastButton
				highContrast={highContrast}
				toggleHighContrast={toggleHighContrast}
			/>
			<DarkModeButton dark={dark} toggleDark={toggleDark} />
		</div>
	);
}

import { useState } from "react";

function ContrastButton({
	highContrast,
	toggleHighContrast,
}: {
	highContrast: boolean;
	toggleHighContrast: () => void;
}) {
	const [rotation, setRotation] = useState(0);

	return (
		<button
			type="button"
			className="cursor-pointer border-0 bg-transparent p-0 text-inherit transition-transform duration-300"
			style={{ transform: `rotate(${rotation}deg)` }}
			onClick={() => {
				setRotation((previous) => previous + 180);
				toggleHighContrast();
			}}
			aria-label={
				highContrast ? "Disable high contrast" : "Enable high contrast"
			}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
				<path d="M12 18a6 6 0 0 0 0-12v12z" fill="currentColor" stroke="none" />
			</svg>
		</button>
	);
}

function DarkModeButton({
	dark,
	toggleDark,
}: {
	dark: boolean;
	toggleDark: () => void;
}) {
	return (
		<button
			type="button"
			className="cursor-pointer border-0 bg-transparent p-0 text-inherit"
			onClick={toggleDark}
			aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{dark ? <SunIcon /> : <MoonIcon />}
		</button>
	);
}

function SunIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path
				d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401z"
				fill="currentColor"
				stroke="none"
			/>
		</svg>
	);
}
