import { motion } from "motion/react"
import type { MouseEvent } from "react"

type ProjectButtonProps = {
	name: string
	path: string
	accessed: Date | string | number
	animationDelay?: number
	onClick?: () => void
	onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void
}

const referenceTime = Date.now()

function formatAccessedDate(accessed: Date | string | number) {
	const accessedDate = new Date(accessed)
	const elapsedMs = referenceTime - accessedDate.getTime()

	if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
		return "just now"
	}

	const minute = 60 * 1000
	const hour = 60 * minute
	const day = 24 * hour
	const week = 7 * day
	const month = 30 * day
	const year = 365 * day

	if (elapsedMs < minute) {
		return "<1 minute ago"
	}

	if (elapsedMs < hour) {
		const minutes = Math.floor(elapsedMs / minute)
		return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
	}

	if (elapsedMs < day) {
		const hours = Math.floor(elapsedMs / hour)
		return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
	}

	if (elapsedMs < week) {
		const days = Math.floor(elapsedMs / day)
		return `${days} ${days === 1 ? "day" : "days"} ago`
	}

	if (elapsedMs < month) {
		const weeks = Math.floor(elapsedMs / week)
		return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`
	}

	if (elapsedMs < year) {
		const months = Math.floor(elapsedMs / month)
		return `${months} ${months === 1 ? "month" : "months"} ago`
	}

	const years = Math.floor(elapsedMs / year)
	return `${years} ${years === 1 ? "year" : "years"} ago`
}

export default function ProjectButton({
	name,
	path,
	accessed,
	animationDelay = 0,
	onClick,
	onContextMenu
}: ProjectButtonProps) {
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
			onContextMenu={onContextMenu}
			className="flex min-h-52 w-full cursor-pointer flex-col justify-between border
      border-neutral-700/50 bg-neutral-800/50 p-4 text-left text-neutral-50
      transition-colors duration-300 hover:border-neutral-700 hover:bg-neutral-800/65"
		>
			<div className="flex min-h-28 items-center justify-center bg-neutral-950">
				<div className="relative h-6 w-9 rounded-sm bg-slate-600">
					<div className="absolute -top-1 left-0 h-3 w-5 rounded-t-sm bg-slate-600" />
				</div>
			</div>

			<div className="mt-3">
				<h2 className="truncate text-lg font-semibold">{name}</h2>
				<p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">{path}</p>
				<p className="mt-1.5 text-xs text-neutral-400">Accessed {formatAccessedDate(accessed)}</p>
			</div>
		</motion.button>
	)
}
