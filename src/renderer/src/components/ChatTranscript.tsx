import type { JSX } from "react"
import { motion } from "motion/react"
import { AlertTriangle, FileText, ListChecks, Terminal, Wrench } from "lucide-react"
import type { TranscriptActivity, TranscriptBlock } from "./chatTranscriptModel"

const blockEnter = {
	initial: { opacity: 0, y: 4 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.18, ease: [0.2, 0, 0, 1] as [number, number, number, number] }
}

export function TranscriptBlockView({ block }: { block: TranscriptBlock }): JSX.Element {
	if (block.kind === "user") {
		return (
			<motion.article
				{...blockEnter}
				data-selectable-text
				className="ml-auto max-w-[78%] select-text rounded-2xl bg-zinc-100 px-3.5 py-2 text-sm leading-6 text-zinc-950 shadow-[0_1px_0_0_rgba(255,255,255,0.04)]"
			>
				<p className="whitespace-pre-wrap">{block.message.text}</p>
			</motion.article>
		)
	}

	return (
		<motion.article
			{...blockEnter}
			data-selectable-text
			className="mr-auto flex max-w-[86%] select-text flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm leading-6 text-zinc-100"
		>
			{block.items.map((item) => {
				if (item.kind === "text") {
					return (
						<p key={item.id} className="whitespace-pre-wrap">
							{item.text}
						</p>
					)
				}
				return <ActivityInline key={item.activity.id} activity={item.activity} />
			})}
			{block.streaming ? <StreamingDots /> : null}
		</motion.article>
	)
}

function ActivityInline({ activity }: { activity: TranscriptActivity }): JSX.Element {
	const meta = activityMeta(activity.kind)
	const Icon = meta.icon
	const isOutput = activity.kind === "command.output"

	return (
		<div
			data-selectable-text
			className={`inline-flex max-w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-5 ${meta.className}`}
		>
			<Icon size={13} className="mt-1 shrink-0" />
			<div className="min-w-0">
				<span className="font-medium">{meta.label}</span>
				<span className="text-neutral-500"> · </span>
				{isOutput ? (
					<code className="block max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-neutral-300">
						{activity.summary}
					</code>
				) : (
					<span className="break-words text-neutral-300">{activity.summary}</span>
				)}
			</div>
		</div>
	)
}

function activityMeta(kind: string): {
	label: string
	icon: typeof Wrench
	className: string
} {
	if (kind === "command.execution" || kind === "command.output") {
		return {
			label: kind === "command.output" ? "Output" : "Command",
			icon: Terminal,
			className: "border-blue-500/20 bg-blue-500/8 text-blue-300"
		}
	}
	if (kind === "file.change") {
		return {
			label: "Files",
			icon: FileText,
			className: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
		}
	}
	if (kind.startsWith("plan.")) {
		return {
			label: "Plan",
			icon: ListChecks,
			className: "border-amber-500/20 bg-amber-500/8 text-amber-300"
		}
	}
	if (kind === "runtime.error") {
		return {
			label: "Error",
			icon: AlertTriangle,
			className: "border-red-500/25 bg-red-500/10 text-red-300"
		}
	}
	return {
		label: kind.includes("tool") ? "Tool" : "Event",
		icon: Wrench,
		className: "border-white/10 bg-white/[0.03] text-neutral-300"
	}
}

export function StreamingDots(): JSX.Element {
	return (
		<span className="mt-1 flex items-center gap-1">
			{[0, 0.15, 0.3].map((delay) => (
				<motion.span
					key={delay}
					className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
					animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
					transition={{
						duration: 1.05,
						repeat: Infinity,
						ease: "easeInOut",
						delay
					}}
				/>
			))}
		</span>
	)
}
