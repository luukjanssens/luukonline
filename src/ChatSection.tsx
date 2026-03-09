import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type ChatMessage, useChat } from "./hooks/useChat";

function formatTime(ts: number): string {
	if (!ts) return "";
	const d = new Date(ts);
	const h = d.getHours().toString().padStart(2, "0");
	const m = d.getMinutes().toString().padStart(2, "0");
	return `${h}:${m}`;
}

function Bubble({ msg: message }: { msg: ChatMessage }) {
	const isLuuk = message.from === "luuk";
	const time = formatTime(message.timestamp);

	return (
		<li
			className={`flex flex-col list-none ${isLuuk ? "items-start" : "items-end"}`}
		>
			<p
				className={`max-w-[60%] text-xs tracking-wide lowercase leading-relaxed border px-3 py-1.5 rounded-2xl ${
					isLuuk
						? "border-current/20 opacity-60"
						: "border-current/10 opacity-90"
				}`}
			>
				{isLuuk && <span className="opacity-50">luuk: </span>}
				{message.text}
			</p>
			<span className="text-[10px] tracking-wide lowercase opacity-30 mt-0.5 px-1">
				{isLuuk
					? `received${time ? ` · ${time}` : ""}`
					: `sent${time ? ` · ${time}` : ""}`}
			</span>
		</li>
	);
}

export function ChatSection({ dark }: { dark: boolean }) {
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
	const background = dark ? "#0a0a0a" : "#f7f7f5";

	// const display = messages.length > 0 ? messages : demo;
	const display = messages;

	const msgCount = display.length;
	const hasMessages = msgCount > 0;
	const sectionHeight = `min(calc(${280 + msgCount * 52}px), calc(100dvh - 56px))`;

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useLayoutEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		element.scrollTop = element.scrollHeight;
	});

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

		const el = labelRef.current;
		el.style.transition = "none";
		el.style.transform = `translateX(${offset}px)`;

		// Force a synchronous reflow so the browser registers the start state
		// before we enable the transition.
		void el.offsetWidth;

		el.style.transition = "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
		el.style.transform = "translateX(0)";
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

	return (
		<section
			className="flex flex-col overflow-hidden"
			style={{
				background,
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
									"linear-gradient(to bottom, transparent, black 8%, black 88%, transparent)",
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
						className={`flex flex-col gap-2 px-5 ${hasMessages ? "py-8" : "py-4"}`}
					>
						{display.map((message) => (
							<Bubble key={message.id} msg={message} />
						))}

						{/* input bubble — inline with message flow */}
						<li
							style={
								inputHidden
									? {
											maxHeight: 0,
											opacity: 0,
											overflow: "hidden",
											transition: "max-height 0.2s ease, opacity 0.15s ease",
											pointerEvents: "none",
										}
									: inputEntering
										? {
												maxHeight: "10rem",
												overflow: "visible",
												transition: "max-height 0.35s ease",
												animation:
													"slide-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
											}
										: {
												maxHeight: "10rem",
												opacity: 1,
												overflow: "visible",
											}
							}
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
									className="max-w-[60%] text-xs tracking-wide lowercase leading-relaxed border bg-white border-current/20 rounded-2xl px-3 py-1.5 inline-flex items-start gap-2 opacity-60 cursor-text"
								>
									<div className="relative grid text-xs tracking-wide lowercase leading-relaxed min-w-[6ch]">
										<span
											className="invisible whitespace-pre-wrap wrap-break-word col-start-1 row-start-1 pointer-events-none"
											aria-hidden
										>
											{`${input}\u200b`}
										</span>
										<textarea
											ref={inputRef}
											value={input}
											onChange={(events) => setInput(events.target.value)}
											onFocus={() => setInputFocused(true)}
											onBlur={() => setInputFocused(false)}
											onKeyDown={(events) => {
												if (events.key === "Enter" && !events.shiftKey) {
													events.preventDefault();
													sendMessage(input);
												}
											}}
											className="bg-transparent outline-none font-[inherit] text-inherit resize-none col-start-1 row-start-1 overflow-hidden w-full"
										/>
										{inputFocused && (
											<span
												className="col-start-1 row-start-1 pointer-events-none whitespace-pre-wrap wrap-break-word"
												aria-hidden
											>
												<span className="invisible">{input}</span>
												<span
													className="inline-block w-[0.55em] h-[1em]
												rounded-xs bg-current align-text-bottom animate-blink-block"
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
