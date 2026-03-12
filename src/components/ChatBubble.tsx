import type { ChatMessage } from "../hooks/useChat";
import { formatTime } from "../utils";

export function ChatBubble({ message }: { message: ChatMessage }) {
	const isLuuk = message.from === "luuk";
	const time = formatTime(message.timestamp);

	return (
		<li
			className={`flex flex-col list-none ${isLuuk ? "items-start" : "items-end"}`}
		>
			<div className="relative max-w-[60%]">
				<p
					className={`text-xs tracking-wide lowercase leading-relaxed border px-2.5 py-1.5 md:px-3 ${
						isLuuk
							? "chat-bubble--received border-current/15 opacity-75"
							: "chat-bubble--sent border-current/10 opacity-90"
					}`}
					style={{
						borderRadius: "1rem",
						...(isLuuk
							? { borderBottomLeftRadius: 0 }
							: { borderBottomRightRadius: 0 }),
					}}
				>
					{isLuuk && <span className="opacity-65">luuk: </span>}
					{message.text}
				</p>
			</div>
			<span className="text-[10px] tracking-wide lowercase mt-0.5 px-1 flex items-center gap-1">
				{isLuuk ? (
					<span className="opacity-45">{`received${time ? ` · ${time}` : ""}`}</span>
				) : (
					<>
						<span className="opacity-45">{time || "sent"}</span>
						<img
							src="/checkmarks.png"
							alt=""
							className="checkmarks h-3.25 w-auto inline-block"
							style={
								message.read
									? {
											filter:
												"invert(40%) sepia(100%) saturate(1500%) hue-rotate(115deg) brightness(110%) contrast(110%)",
										}
									: { opacity: 0.3 }
							}
						/>
					</>
				)}
			</span>
		</li>
	);
}
