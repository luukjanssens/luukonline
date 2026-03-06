import { useEffect, useState } from "react";

export function useDarkMode(): [boolean, () => void] {
	const [dark, setDark] = useState(
		() => window.matchMedia("(prefers-color-scheme: dark)").matches,
	);

	useEffect(() => {
		document.documentElement.setAttribute(
			"data-theme",
			dark ? "dark" : "light",
		);
	}, [dark]);

	return [dark, () => setDark((d) => !d)];
}
