import {
	type CSSProperties,
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { ChatBubble } from "./components/ChatBubble";
import {
	COLLAPSE_TRANSITION_DURATION,
	FIRST_SEND_COLLAPSE_DELAY,
	SUBSEQUENT_COLLAPSE_DELAY,
	TYPEWRITER_DELAY,
} from "./constants/animation";
import { useChat } from "./hooks/useChat";

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
	const prevGridSizeRef = useRef<{ width: number; height: number } | null>(
		null,
	);
	const pendingFlipLeft = useRef<number | null>(null);
	// Two-step animation guards: both must be true before the new input reveals
	const flipDoneRef = useRef(true);
	const msgDoneRef = useRef(true);
	const waitingForConfirmation = useRef(false);
	const prevDisplayLengthRef = useRef(0);
	const [typedPlaceholder, setTypedPlaceholder] = useState(placeholder);
	const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstPlaceholderRender = useRef(true);
	const [showDivider, setShowDivider] = useState(false);
	const dividerIndexRef = useRef<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: input and inputFocused drive DOM changes we measure imperatively — they are not read as JS values but trigger the right re-runs
	useLayoutEffect(() => {
		const element = gridRef.current;
		if (!element) return;

		// Cancel any in-flight animation and measure the new natural dimensions.
		element.style.transition = "none";
		element.style.width = "";
		element.style.height = "";
		const newWidth = element.offsetWidth;
		const newHeight = element.scrollHeight;

		const previous = prevGridSizeRef.current;
		prevGridSizeRef.current = { width: newWidth, height: newHeight };

		if (previous === null) {
			void element.offsetHeight;
			return;
		}

		const widthChanged = previous.width !== newWidth;
		const heightChanged = previous.height !== newHeight;

		if (!widthChanged && !heightChanged) {
			void element.offsetHeight;
			return;
		}

		// FLIP: pin at old dimensions, force reflow, then let CSS transition to new.
		if (widthChanged) element.style.width = `${previous.width}px`;
		if (heightChanged) element.style.height = `${previous.height}px`;
		void element.offsetHeight;

		const transitionProperties = [
			widthChanged && "width",
			heightChanged && "height",
		]
			.filter(Boolean)
			.map((property) => `${property} 0.2s ease-in-out`)
			.join(", ");
		element.style.transition = transitionProperties;
		if (widthChanged) element.style.width = `${newWidth}px`;
		if (heightChanged) element.style.height = `${newHeight}px`;

		let fired = 0;
		const expected = (widthChanged ? 1 : 0) + (heightChanged ? 1 : 0);
		const onDone = () => {
			if (++fired < expected) return;
			element.style.transition = "";
			element.style.width = "";
			element.style.height = "";
		};
		element.addEventListener("transitionend", onDone);
		return () => element.removeEventListener("transitionend", onDone);
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
		prevDisplayLengthRef.current = messages.length;
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
				typewriterRef.current = setTimeout(type, TYPEWRITER_DELAY);
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
		if (display.length <= prevDisplayLengthRef.current) return;
		prevDisplayLengthRef.current = display.length;
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
		const collapseDelay = isFirst
			? FIRST_SEND_COLLAPSE_DELAY
			: SUBSEQUENT_COLLAPSE_DELAY;
		setTimeout(() => {
			setInputHidden(true);
			// Allow the collapse transition to complete, then open step-2 gate.
			setTimeout(() => {
				flipDoneRef.current = true;
				maybeReveal();
			}, COLLAPSE_TRANSITION_DURATION);
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
										<span className="text-[10px] tracking-wide lowercase opacity-40">
											new messages
										</span>
										<span className="flex-1 border-t border-current/15" />
									</li>
								)}
								<ChatBubble message={message} />
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
											onChange={(event) => setInput(event.target.value)}
											onFocus={() => setInputFocused(true)}
											onBlur={() => setInputFocused(false)}
											onKeyDown={(event) => {
												if (event.key === "Enter" && !event.shiftKey) {
													event.preventDefault();
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
