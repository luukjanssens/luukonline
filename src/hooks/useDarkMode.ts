import { useEffect, useState } from "react";

const STORAGE_KEY = "dark-mode";

function getInitialValue(): boolean {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored !== null) return stored === "true";
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode(): [boolean, () => void] {
	const [dark, setDark] = useState(getInitialValue);

	useEffect(() => {
		document.documentElement.setAttribute(
			"data-theme",
			dark ? "dark" : "light",
		);
		localStorage.setItem(STORAGE_KEY, String(dark));
	}, [dark]);

	return [dark, () => setDark((isDark) => !isDark)];
}
