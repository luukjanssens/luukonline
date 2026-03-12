export function formatLastSeen(timestamp: number): string {
	const date = new Date(timestamp);
	const timeString = date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	if (date.toDateString() === new Date().toDateString()) return timeString;
	const dateString = date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});
	return `${dateString} at ${timeString}`;
}
