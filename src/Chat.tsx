import {
	Fragment,
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

export function Chat({
	placeholder,
	onChatStart,
}: {
	placeholder: string;
	onChatStart?: () => void;
}) {
	const { messages, connected, send, hasHistory, newMessageCount } = useChat();
	const [input, setInput] = useState("");
	const [hasSentMessage, setHasSentMessage] = useState(false);
	const [inputHidden, setInputHidden] = useState(false);
	const [inputEntering, setInputEntering] = useState(false);
	const [inputFocused, setInputFocused] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const labelRef = useRef<HTMLLabelElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const prevGridSizeRef = useRef<{ w: number; h: number } | null>(null);
	const pendingFlipLeft = useRef<number | null>(null);
	// Two-step animation guards: both must be true before the new input reveals
	const flipDoneRef = useRef(true);
	const msgDoneRef = useRef(true);
	const waitingForConfirmation = useRef(false);
	const prevDisplayLenRef = useRef(0);
	const [typedPlaceholder, setTypedPlaceholder] = useState(placeholder);
	const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstPlaceholderRender = useRef(true);
	const [showDivider, setShowDivider] = useState(false);
	const dividerIndexRef = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: input and inputFocused drive DOM changes we measure imperatively — they are not read as JS values but trigger the right re-runs
	useLayoutEffect(() => {
		const el = gridRef.current;
		if (!el) return;

		// Cancel any in-flight animation and measure the new natural dimensions.
		el.style.transition = "none";
		el.style.width = "";
		el.style.height = "";
		const newW = el.offsetWidth;
		const newH = el.scrollHeight;

		const prev = prevGridSizeRef.current;
		prevGridSizeRef.current = { w: newW, h: newH };

		if (prev === null) {
			void el.offsetHeight;
			return;
		}

		const wChanged = prev.w !== newW;
		const hChanged = prev.h !== newH;

		if (!wChanged && !hChanged) {
			void el.offsetHeight;
			return;
		}

		// FLIP: pin at old dimensions, force reflow, then let CSS transition to new.
		if (wChanged) el.style.width = `${prev.w}px`;
		if (hChanged) el.style.height = `${prev.h}px`;
		void el.offsetHeight;

		const props = [wChanged && "width", hChanged && "height"]
			.filter(Boolean)
			.map((p) => `${p} 0.2s ease-in-out`)
			.join(", ");
		el.style.transition = props;
		if (wChanged) el.style.width = `${newW}px`;
		if (hChanged) el.style.height = `${newH}px`;

		let fired = 0;
		const expected = (wChanged ? 1 : 0) + (hChanged ? 1 : 0);
		const onDone = () => {
			if (++fired < expected) return;
			el.style.transition = "";
			el.style.width = "";
			el.style.height = "";
		};
		el.addEventListener("transitionend", onDone);
		return () => el.removeEventListener("transitionend", onDone);
	}, [input, inputFocused]);

	const display = messages;
	const messageCount = display.length;
	const hasMessages = messageCount > 0;
	const sectionHeight = `min(calc(${280 + messageCount * 52}px), calc(100dvh - 56px))`;

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once when history loads — messages and newMessageCount are populated at that point
	useEffect(() => {
		if (!hasHistory) return;
		setHasSentMessage(true);
		prevDisplayLenRef.current = messages.length;
		if (newMessageCount > 0) {
			dividerIndexRef.current = messages.length - newMessageCount;
			setShowDivider(true);
		}
	}, [hasHistory]);

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
		setShowDivider(false);
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
			className="flex flex-col overflow-hidden w-full md:w-[60dvw] md:max-w-3xl"
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
					className="w-full overflow-y-auto "
					style={{ scrollbarWidth: "none" }}
				>
					<ul
						role="log"
						aria-label="chat messages"
						className={`flex flex-col gap-1.5 md:gap-2 px-3 md:px-5 ${hasMessages ? "py-8" : "py-4"}`}
					>
{display.map((message, index) => (
						<Fragment key={message.id}>
							{showDivider && index === dividerIndexRef.current && (
								<li className="flex items-center gap-2 py-1 list-none">
									<span className="flex-1 border-t border-current/15" />
									<span className="text-[10px] tracking-wide lowercase opacity-40">new messages</span>
									<span className="flex-1 border-t border-current/15" />
								</li>
							)}
							<Bubble msg={message} />
						</Fragment>
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
									className={`chat-bubble--sent relative max-w-[80%] md:max-w-[60%] text-xs tracking-wide lowercase leading-relaxed border border-current/15 px-2.5 py-1.5 md:px-3 inline-flex items-start gap-2 cursor-text transition-opacity duration-200 ${inputFocused ? "opacity-90" : hasSentMessage ? "opacity-35" : "animate-chat-nudge"}`}
									style={{ borderRadius: "1rem", borderBottomRightRadius: 0 }}
								>
									<div
										ref={gridRef}
										className="relative grid text-xs tracking-wide lowercase leading-relaxed"
									>
										<span
											className="invisible whitespace-pre-wrap wrap-break-word col-start-1 row-start-1 pointer-events-none"
											aria-hidden
										>
											{`${input || (!hasSentMessage && !inputFocused ? placeholder : "")}\u200b`}
										</span>
										{!input && !hasSentMessage && !inputFocused && (
											<span
												className="col-start-1 row-start-1 pointer-events-none whitespace-pre-wrap wrap-break-word"
												aria-hidden
											>
												{typedPlaceholder}
											</span>
										)}
										<textarea
											ref={inputRef}
											value={input}
											placeholder={
												hasSentMessage || inputFocused ? "" : placeholder
											}
											onChange={(events) => setInput(events.target.value)}
											onFocus={() => setInputFocused(true)}
											onBlur={() => setInputFocused(false)}
											onKeyDown={(events) => {
												if (events.key === "Enter" && !events.shiftKey) {
													events.preventDefault();
													sendMessage(input);
												}
											}}
											aria-label="write a message"
											className="bg-transparent outline-none font-[inherit] text-inherit resize-none col-start-1 row-start-1 overflow-hidden w-full placeholder:opacity-0"
										/>
										<span
											className="col-start-1 row-start-1 pointer-events-none whitespace-pre-wrap wrap-break-word"
											aria-hidden
										>
											<span className="invisible">{input}</span>
											{inputFocused && (
												<span className="inline-block w-[0.55em] h-[1em] rounded-xs bg-current align-text-bottom mb-0.5 animate-blink-block" />
											)}
										</span>
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
