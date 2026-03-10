import {
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type ChatMessage, useChat } from "./hooks/useChat";

function formatTime(timestamp: number): string {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	return `${hours}:${minutes}`;
}

function Bubble({ msg: message }: { msg: ChatMessage }) {
	const isLuuk = message.from === "luuk";
	const time = formatTime(message.timestamp);

	return (
		<li
			className={`flex flex-col list-none ${isLuuk ? "items-start" : "items-end"}`}
		>
			<div className="relative max-w-[80%] md:max-w-[60%]">
				<p
					className={`text-xs tracking-wide lowercase leading-relaxed border px-2.5 py-1.5 md:px-3 ${
						isLuuk
							? "chat-bubble--received border-current/15 opacity-60"
							: "chat-bubble--sent border-current/10 opacity-90"
					}`}
					style={{
						borderRadius: "1rem",
						...(isLuuk
							? { borderBottomLeftRadius: 0 }
							: { borderBottomRightRadius: 0 }),
					}}
				>
					{isLuuk && <span className="opacity-50">luuk: </span>}
					{message.text}
				</p>
			</div>
			<span className="text-[10px] tracking-wide lowercase mt-0.5 px-1 flex items-center gap-1">
				{isLuuk ? (
					<span className="opacity-30">{`received${time ? ` · ${time}` : ""}`}</span>
				) : (
					<>
						<span className="opacity-30">{time || "sent"}</span>
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

export function Chat({
	placeholder,
	onChatStart,
}: {
	placeholder: string;
	onChatStart?: () => void;
}) {
	const { messages, connected, send } = useChat();
	const [input, setInput] = useState("");
	const [hasSentMessage, setHasSentMessage] = useState(false);
	const [inputHidden, setInputHidden] = useState(false);
	const [inputEntering, setInputEntering] = useState(false);
	const [inputFocused, setInputFocused] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const labelRef = useRef<HTMLLabelElement>(null);
	const pendingFlipLeft = useRef<number | null>(null);
	// Two-step animation guards: both must be true before the new input reveals
	const flipDoneRef = useRef(true);
	const msgDoneRef = useRef(true);
	const waitingForConfirmation = useRef(false);
	const prevDisplayLenRef = useRef(0);
	const [typedPlaceholder, setTypedPlaceholder] = useState(placeholder);
	const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstPlaceholderRender = useRef(true);

	const display = messages;
	const messageCount = display.length;
	const hasMessages = messageCount > 0;
	const sectionHeight = `min(calc(${280 + messageCount * 52}px), calc(100dvh - 56px))`;

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		if (isFirstPlaceholderRender.current) {
			isFirstPlaceholderRender.current = false;
			return;
		}
		if (typewriterRef.current) clearTimeout(typewriterRef.current);
		setTypedPlaceholder("");
		let i = 0;
		const type = () => {
			setTypedPlaceholder(placeholder.slice(0, i + 1));
			i++;
			if (i < placeholder.length) {
				typewriterRef.current = setTimeout(type, 50);
			}
		};
		typewriterRef.current = setTimeout(type, 0);
		return () => {
			if (typewriterRef.current) clearTimeout(typewriterRef.current);
		};
	}, [placeholder]);

	useLayoutEffect(() => {
		if (
			!hasSentMessage ||
			pendingFlipLeft.current === null ||
			!labelRef.current
		)
			return;

		const firstLeft = pendingFlipLeft.current;
		pendingFlipLeft.current = null;

		const lastLeft = labelRef.current.getBoundingClientRect().left;
		const offset = firstLeft - lastLeft;

		if (Math.abs(offset) < 1) return;

		const labelElement = labelRef.current;
		labelElement.style.transition = "none";
		labelElement.style.transform = `translateX(${offset}px)`;

		// Force a synchronous reflow so the browser registers the start state
		// before we enable the transition.
		void labelElement.offsetWidth;

		labelElement.style.transition =
			"transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
		labelElement.style.transform = "translateX(0)";
		// Intentionally leave transform: translateX(0) in place after the animation.
		// Clearing it would cause the browser to de-promote the element from the GPU
		// compositor layer, producing a visible repaint flash.
	}, [hasSentMessage]);

	// Reveal the input bubble once BOTH the slide animation AND the message
	// confirmation have completed.
	const maybeReveal = useCallback(() => {
		if (!flipDoneRef.current || !msgDoneRef.current) return;
		waitingForConfirmation.current = false;
		setInputHidden(false);
		setInputEntering(true);
	}, []);

	// Step 2 gate: fires when a new message lands in the conversation.
	useEffect(() => {
		if (!waitingForConfirmation.current) return;
		if (display.length <= prevDisplayLenRef.current) return;
		prevDisplayLenRef.current = display.length;
		msgDoneRef.current = true;
		maybeReveal();
	}, [display.length, maybeReveal]);

	function sendMessage(text: string) {
		if (!text.trim() || !connected) return;
		const isFirst = !hasSentMessage;

		// Reset two-step gates.
		flipDoneRef.current = false;
		msgDoneRef.current = false;
		waitingForConfirmation.current = true;

		if (isFirst) {
			pendingFlipLeft.current =
				labelRef.current?.getBoundingClientRect().left ?? null;
			setHasSentMessage(true);
			onChatStart?.();
		}

		send(text.trim());
		setInput("");
		inputRef.current?.focus();

		// Step 1 ends: collapse the input after the slide finishes.
		// For the first send we wait for the FLIP (≈550 ms); subsequent sends
		// collapse quickly since the bubble is already on the right.
		const collapseDelay = isFirst ? 570 : 40;
		setTimeout(() => {
			setInputHidden(true);
			// Allow the collapse transition to complete, then open step-2 gate.
			setTimeout(() => {
				flipDoneRef.current = true;
				maybeReveal();
			}, 200);
		}, collapseDelay);
	}

	let inputBubbleStyle: CSSProperties;
	if (inputHidden) {
		inputBubbleStyle = {
			maxHeight: 0,
			opacity: 0,
			overflow: "hidden",
			transition: "max-height 0.2s ease, opacity 0.15s ease",
			pointerEvents: "none",
		};
	} else if (inputEntering) {
		inputBubbleStyle = {
			maxHeight: "10rem",
			overflow: "visible",
			transition: "max-height 0.35s ease",
			animation: "slide-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
		};
	} else {
		inputBubbleStyle = {
			maxHeight: "10rem",
			opacity: 1,
			overflow: "visible",
		};
	}

	return (
		<section
			className="flex flex-col overflow-hidden"
			style={{
				height: sectionHeight,
				transition: "height 0.35s ease",
			}}
		>
			<div
				className="flex-1 overflow-hidden flex justify-center"
				style={
					hasMessages
						? {
								maskImage:
									"linear-gradient(to bottom, transparent, black 8%, black 100%, transparent)",
							}
						: undefined
				}
			>
				<div
					ref={scrollRef}
					className="w-full md:w-[60dvw] max-w-3xl overflow-y-auto "
					style={{ scrollbarWidth: "none" }}
				>
					<ul
						role="log"
						aria-label="chat messages"
						className={`flex flex-col gap-1.5 md:gap-2 px-3 md:px-5 ${hasMessages ? "py-8" : "py-4"}`}
					>
						{display.map((message) => (
							<Bubble key={message.id} msg={message} />
						))}

						{/* input bubble — inline with message flow */}
						<li
							style={inputBubbleStyle}
							onAnimationEnd={() => {
								setInputEntering(false);
								inputRef.current?.focus();
							}}
						>
							<div
								className={`flex ${hasSentMessage ? "justify-end" : "justify-center"}`}
							>
								<label
									ref={labelRef}
									className="chat-bubble--sent relative max-w-[80%] md:max-w-[60%] text-xs tracking-wide lowercase leading-relaxed border border-current/15 px-2.5 py-1.5 md:px-3 inline-flex items-start gap-2 opacity-60 cursor-text"
									style={{ borderRadius: "1rem", borderBottomRightRadius: 0 }}
								>
									<div className="relative grid text-xs tracking-wide lowercase leading-relaxed min-w-[6ch]">
										<span
											className="invisible whitespace-pre-wrap wrap-break-word col-start-1 row-start-1 pointer-events-none"
											aria-hidden
										>
											{`${input || (hasSentMessage ? "" : placeholder)}\u200b`}
										</span>
										{!input && !hasSentMessage && (
											<span
												className="col-start-1 row-start-1 pointer-events-none whitespace-pre-wrap wrap-break-word opacity-30"
												aria-hidden
											>
												{typedPlaceholder}
											</span>
										)}
										<textarea
											ref={inputRef}
											value={input}
											placeholder={hasSentMessage ? "" : placeholder}
											onChange={(events) => setInput(events.target.value)}
											onFocus={() => setInputFocused(true)}
											onBlur={() => setInputFocused(false)}
											onKeyDown={(events) => {
												if (events.key === "Enter" && !events.shiftKey) {
													events.preventDefault();
													sendMessage(input);
												}
											}}
											className="bg-transparent outline-none font-[inherit] text-inherit resize-none col-start-1 row-start-1 overflow-hidden w-full placeholder:opacity-0"
										/>
										{inputFocused && (
											<span
												className="col-start-1 row-start-1 pointer-events-none whitespace-pre-wrap wrap-break-word"
												aria-hidden
											>
												<span className="invisible">{input}</span>
												<span
													className="inline-block w-[0.55em] h-[1em]
												rounded-xs bg-current align-text-bottom animate-blink-block mb-0.5"
												/>
											</span>
										)}
									</div>
								</label>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</section>
	);
}
