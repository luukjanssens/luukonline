function ChatBubble({
	sender,
	children,
}: {
	sender: "sender" | "receiver";
	children: React.ReactNode;
}) {
	return (
		<div
			className={`border rounded-2xl px-4 py-2 max-w-[80%] ${
				sender === "sender"
					? "self-end border-blue-300"
					: "self-start border-green-300"
			}`}
		>
			{children}
		</div>
	);
}

export function ChatSection({ dark }: { dark: boolean }) {
	return (
		<section
			className="flex-1 flex items-center justify-center mask-[linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] max-h-[220px]"
			style={{ background: dark ? "#0a0a0a" : "#f7f7f5" }}
		>
			<div className="border-x border-gray-400 md:w-[60dvw] max-w-3xl flex flex-col gap-4 p-6">
				<ChatBubble sender="sender">Bubble sender</ChatBubble>
				<ChatBubble sender="receiver">Bubble receiver</ChatBubble>
			</div>
		</section>
	);
}
