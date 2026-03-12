interface SendMessageOptions {
	replyToMessageId?: number;
	parseMode?: string;
}

/** Escape special characters for Telegram MarkdownV2 — defensive guard against injection if parse_mode is ever added. */
export function escapeTelegramText(text: string): string {
	return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

export async function sendTelegramMessage(
	botToken: string,
	chatId: string,
	text: string,
	options?: SendMessageOptions,
): Promise<{ ok: boolean; result?: { message_id: number } }> {
	const body: Record<string, unknown> = {
		chat_id: chatId,
		text,
	};
	if (options?.replyToMessageId) {
		body.reply_to_message_id = options.replyToMessageId;
	}
	if (options?.parseMode) {
		body.parse_mode = options.parseMode;
	}

	const response = await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
	);

	return response.json() as Promise<{
		ok: boolean;
		result?: { message_id: number };
	}>;
}
