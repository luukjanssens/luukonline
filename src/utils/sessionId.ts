const STORAGE_KEY = "chat_session_id";

export function getOrCreateSessionId(): string {
	const existing = localStorage.getItem(STORAGE_KEY);
	if (existing) return existing;
	const id = crypto.randomUUID();
	localStorage.setItem(STORAGE_KEY, id);
	return id;
}
