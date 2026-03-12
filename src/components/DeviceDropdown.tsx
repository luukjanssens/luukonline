import { AnimatePresence, motion } from "motion/react";
import {
	DEVICE_PILL_DURATION,
	DEVICE_PILL_STAGGER,
} from "../constants/animation";

export interface DeviceItem {
	key: string;
	text: string;
	pillText: string;
}

export function DeviceDropdown({
	deviceItems,
	isExpanded,
}: {
	deviceItems: DeviceItem[];
	isExpanded: boolean;
}) {
	if (deviceItems.length === 0) return null;

	return (
		<div
			className="grid w-full overflow-hidden"
			style={{
				gridTemplateRows: isExpanded ? "1fr" : "0fr",
				transition: isExpanded
					? "grid-template-rows 0.35s cubic-bezier(0.22, 1, 0.36, 1)"
					: "grid-template-rows 0.28s cubic-bezier(0.6, 0, 0.8, 0)",
			}}
		>
			<div className="min-h-0 overflow-hidden">
				<div className="flex justify-center pt-3 pb-2">
					<div className="inline-flex flex-col items-center gap-2">
						<AnimatePresence>
							{isExpanded &&
								deviceItems.map((item, index) => (
									<motion.div
										key={item.key}
										className="relative"
										initial={{ opacity: 0, scale: 0.8, y: -10 }}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										exit={{
											opacity: 0,
											scale: 0.8,
											y: -10,
											transition: {
												duration: 0.2,
												ease: [0.6, 0, 0.8, 0],
												delay: index * 0.05,
											},
										}}
										transition={{
											delay: index * DEVICE_PILL_STAGGER,
											duration: DEVICE_PILL_DURATION,
											ease: [0.22, 1, 0.36, 1],
										}}
									>
										<span className="device-pill inline-flex items-center px-4 py-1 text-xs font-light tracking-widest lowercase whitespace-nowrap rounded-full">
											{item.pillText}
										</span>
									</motion.div>
								))}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</div>
	);
}
