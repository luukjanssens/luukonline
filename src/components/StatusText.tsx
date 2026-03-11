import { CHAR_STAGGER_DELAY } from "../constants/animation";

const LUUK_IS_CHARS = [..."luuk is"].map((character, index) => ({
	character,
	key: `li${index}`,
	delay: `${index * CHAR_STAGGER_DELAY}s`,
}));

const STATUS_LABEL_CHARS: Record<
	"online" | "offline",
	Array<{ character: string; key: string; delay: string }>
> = {
	online: [..."online"].map((character, index) => ({
		character,
		key: `on${index}`,
		delay: `${(LUUK_IS_CHARS.length + index) * CHAR_STAGGER_DELAY}s`,
	})),
	offline: [..."offline"].map((character, index) => ({
		character,
		key: `of${index}`,
		delay: `${(LUUK_IS_CHARS.length + index) * CHAR_STAGGER_DELAY}s`,
	})),
};

const DOT_DELAY = `${LUUK_IS_CHARS.length * CHAR_STAGGER_DELAY}s`;

export function StatusText({
	status,
	statusColor,
}: {
	status: "online" | "offline";
	statusColor: string;
}) {
	const labelChars = STATUS_LABEL_CHARS[status];
	return (
		<>
			<span className="opacity-65 inline-flex">
				{LUUK_IS_CHARS.map(({ character, key, delay }) => (
					<span
						key={key}
						className="animate-reveal-char"
						style={{ animationDelay: delay }}
					>
						{character === " " ? "\u00a0" : character}
					</span>
				))}
			</span>
			<span
				className="inline-flex items-center gap-2 transition-colors duration-600"
				style={{ color: statusColor }}
			>
				<span
					className="inline-flex animate-reveal-char"
					style={{ animationDelay: DOT_DELAY }}
				>
					<span className="inline-block size-1.5 shrink-0 rounded-full bg-current animate-pulse-dot shadow-sm mt-0.5" />
				</span>
				<span className="inline-flex">
					{labelChars.map(({ character, key, delay }) => (
						<span
							key={key}
							className="animate-reveal-char"
							style={{ animationDelay: delay }}
						>
							{character}
						</span>
					))}
				</span>
			</span>
		</>
	);
}
