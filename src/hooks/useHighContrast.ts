import { useEffect, useState } from "react";

export function useHighContrast(): [boolean, () => void] {
	const [highContrast, setHighContrast] = useState(
		() => localStorage.getItem("high-contrast") === "true",
	);

	useEffect(() => {
		if (highContrast) {
			document.documentElement.setAttribute("data-contrast", "high");
		} else {
			document.documentElement.removeAttribute("data-contrast");
		}
		localStorage.setItem("high-contrast", String(highContrast));
	}, [highContrast]);

	return [
		highContrast,
		() => setHighContrast((isHighContrast) => !isHighContrast),
	];
}
