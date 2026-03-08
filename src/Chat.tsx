import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ChatMessage, useChat } from "./hooks/useChat";

interface ChatProps {
	dark: boolean;
}

function Message({ msg }: { msg: ChatMessage }) {
	const isVisitor = msg.from === "visitor";
	return (
		<div className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
			<span
				className={`max-w-[85%] text-xs tracking-wide lowercase leading-relaxed ${
					isVisitor ? "opacity-60" : "opacity-90"
				}`}
			>
				{!isVisitor && <span className="opacity-50">luuk: </span>}
				{msg.text}
			</span>
		</div>
	);
}

export default function Chat({ dark }: ChatProps) {
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const { messages, connected, send } = useChat();
	const bottomRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const bg = dark ? "#0a0a0a" : "#f7f7f5";

	useEffect(() => {
		if (!open) return;
		setTimeout(() => inputRef.current?.focus(), 50);
	}, [open]);

	useEffect(() => {
		if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [open, messages.length]);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const text = input.trim();
		if (!text || !connected) return;
		send(text);
		setInput("");
	}

	return (
		<>
			{open && (
				<div
					className="absolute bottom-14 left-7 w-72 flex flex-col border border-current/10"
					style={{ background: bg }}
				>
					{/* header */}
					<div className="flex items-center justify-between px-4 py-2 border-b border-current/10">
						<span className="text-xs tracking-widest lowercase opacity-40">
							chat with luuk
						</span>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="opacity-30 hover:opacity-60 transition-opacity text-xs cursor-pointer bg-transparent border-0 p-0 font-[inherit] text-inherit"
						>
							✕
						</button>
					</div>

					{/* messages */}
					<div className="h-44 overflow-y-auto flex flex-col gap-2.5 p-4">
						{messages.length === 0 && (
							<span className="text-xs tracking-wide lowercase opacity-25">
								say something…
							</span>
						)}
						{messages.map((m) => (
							<Message key={m.id} msg={m} />
						))}
						<div ref={bottomRef} />
					</div>

					{/* input */}
					<form
						onSubmit={handleSubmit}
						className="flex border-t border-current/10"
					>
						<input
							ref={inputRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder={connected ? "type something…" : "connecting…"}
							disabled={!connected}
							className="flex-1 bg-transparent px-4 py-2 text-xs tracking-wide lowercase outline-none placeholder:opacity-25 disabled:opacity-30 font-[inherit] text-inherit"
						/>
						<button
							type="submit"
							disabled={!connected || !input.trim()}
							className="px-3 py-2 text-xs opacity-30 hover:opacity-60 disabled:opacity-15 transition-opacity lowercase tracking-widest cursor-pointer bg-transparent border-0 font-[inherit] text-inherit"
						>
							send
						</button>
					</form>
				</div>
			)}

			<button
				type="button"
				onClick={() => setOpen((p) => !p)}
				className="absolute left-7 bottom-6 cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs tracking-widest lowercase text-inherit opacity-30 transition-opacity duration-200 hover:opacity-70"
			>
				{open ? "close" : "say hello"}
			</button>
		</>
	);
}
