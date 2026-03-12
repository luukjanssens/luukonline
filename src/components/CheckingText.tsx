import { WAVE_STAGGER_DELAY } from "../constants/animation";

const CHECKING_CHARS = [..."is luuk online?"].map((character, index) => ({
	character,
	key: `c${index}`,
	delay: `${index * WAVE_STAGGER_DELAY}s`,
}));

export function CheckingText() {
	return (
		<span className="inline-flex" aria-hidden>
			{CHECKING_CHARS.map(({ character, key, delay }) => (
				<span
					key={key}
					className="animate-letter-wave"
					style={{ animationDelay: delay }}
				>
					{character === " " ? "\u00a0" : character}
				</span>
			))}
		</span>
	);
}
