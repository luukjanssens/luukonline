export function generateMessageId(timestamp: number): string {
	return `${timestamp}-${Math.random()}`;
}
