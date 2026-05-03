import { motion } from "motion/react"

type NewProjectButtonProps = {
	animationDelay?: number
	onClick?: () => void
}

export default function NewProjectButton({ animationDelay = 0, onClick }: NewProjectButtonProps) {
	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, y: 32 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				delay: animationDelay,
				duration: 0.9,
				ease: [0.22, 1, 0.36, 1]
			}}
			onClick={onClick}
			className="flex min-h-48 w-full cursor-pointer flex-col items-center
      justify-center gap-4 border-2 border-dashed border-neutral-800
      bg-transparent text-neutral-500 transition-colors duration-300 hover:border-neutral-700
      hover:text-neutral-400"
		>
			<span
				className="flex size-11 items-center justify-center rounded-full
      border border-neutral-800 text-3xl transition-colors duration-300"
			>
				+
			</span>
			<span className="text-xs font-bold tracking-wide uppercase">Create New Project</span>
		</motion.button>
	)
}
