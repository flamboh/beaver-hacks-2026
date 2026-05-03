import { useState, type JSX, type ReactNode } from "react"
import { ChevronDown, SlidersHorizontal } from "lucide-react"
import type { AgentModelOption } from "../../../main/agent/ipc"

interface AgentRunSettingsProps {
	modelOptions: AgentModelOption[]
	selectedModel: string
	runtimeModel?: string | null
	effort?: string
	speedTier?: string | null
	planningMode?: boolean
	securityMode?: boolean
	onModelChange?: (model: string) => void
	onEffortChange?: (effort: string) => void
	onSpeedTierChange?: (speedTier: string | null) => void
	onPlanningModeChange?: (planningMode: boolean) => void
	onSecurityModeChange?: (securityMode: boolean) => void
}

export function AgentRunSettings({
	modelOptions,
	selectedModel,
	runtimeModel,
	effort,
	speedTier,
	planningMode = false,
	securityMode = false,
	onModelChange,
	onEffortChange,
	onSpeedTierChange,
	onPlanningModeChange,
	onSecurityModeChange
}: AgentRunSettingsProps): JSX.Element {
	const [open, setOpen] = useState(false)
	const selectedOption = modelOptions.find((option) => option.id === selectedModel)
	const effortOptions = selectedOption?.reasoningEfforts ?? []
	const speedOptions = selectedOption?.speedTiers ?? []
	const selectedEffort =
		effortOptions.find((option) => option.id === effort)?.id ??
		effortOptions.find((option) => option.isDefault)?.id ??
		effortOptions[0]?.id ??
		""
	const selectedSpeedTier = speedOptions.some((option) => option.id === speedTier)
		? (speedTier ?? null)
		: null
	const hasSettings = effortOptions.length > 0 || speedOptions.length > 0

	return (
		<div className="flex min-w-0 flex-col items-end gap-1">
			<div className="relative flex items-center gap-1">
				<ModeSwitch
					label="Plan"
					enabled={planningMode}
					onToggle={() => onPlanningModeChange?.(!planningMode)}
					theme="emerald"
					title={`Planning mode ${planningMode ? "on" : "off"}`}
				/>
				<ModeSwitch
					label="Secure"
					enabled={securityMode}
					onToggle={() => onSecurityModeChange?.(!securityMode)}
					theme="cyan"
					title={`Security mode ${securityMode ? "on" : "off"}`}
				/>
				<div className="relative w-40">
					<select
						value={selectedModel}
						disabled={!onModelChange}
						onChange={(event) => onModelChange?.(event.currentTarget.value)}
						className="h-7 w-full cursor-pointer appearance-none truncate rounded-md border border-white/5 bg-white/[0.03] px-2 pr-6 font-mono text-[11px] text-neutral-500 outline-none transition-colors duration-150 hover:border-white/10 hover:text-neutral-300 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-45"
						aria-label="Agent model"
						title={selectedModel}
					>
						{modelOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
					<ChevronDown
						size={12}
						className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-neutral-600"
					/>
				</div>
				<button
					type="button"
					disabled={!hasSettings}
					onClick={() => setOpen((value) => !value)}
					className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-neutral-500 transition-colors duration-150 hover:border-white/10 hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-45"
					aria-label="Run settings"
					title="Run settings"
				>
					<SlidersHorizontal size={13} />
				</button>
				{open && hasSettings ? (
					<div className="absolute right-0 bottom-full z-20 mb-2 w-72 rounded-lg border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
						{effortOptions.length > 0 ? (
							<RunSettingsGroup label="Reasoning">
								{effortOptions.map((option) => (
									<button
										key={option.id}
										type="button"
										onClick={() => {
											onEffortChange?.(option.id)
											setOpen(false)
										}}
										className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
											selectedEffort === option.id
												? "border-blue-500/40 bg-blue-500/10 text-blue-300"
												: "border-white/5 bg-white/[0.02] text-neutral-500 hover:border-white/10 hover:text-neutral-300"
										}`}
										title={option.description ?? option.label}
									>
										{option.label}
									</button>
								))}
							</RunSettingsGroup>
						) : null}
						{speedOptions.length > 0 ? (
							<RunSettingsGroup label="Speed">
								<SpeedButton
									active={selectedSpeedTier === null}
									label="Auto"
									onClick={() => {
										onSpeedTierChange?.(null)
										setOpen(false)
									}}
								/>
								{speedOptions.map((option) => (
									<SpeedButton
										key={option.id}
										active={selectedSpeedTier === option.id}
										label={option.label}
										onClick={() => {
											onSpeedTierChange?.(option.id)
											setOpen(false)
										}}
									/>
								))}
							</RunSettingsGroup>
						) : null}
					</div>
				) : null}
			</div>
			{runtimeModel && runtimeModel !== selectedModel ? (
				<span className="max-w-40 truncate text-right font-mono text-[10px] text-neutral-700">
					running {runtimeModel}
				</span>
			) : null}
		</div>
	)
}

function ModeSwitch({
	label,
	enabled,
	onToggle,
	theme,
	title
}: {
	label: string
	enabled: boolean
	onToggle: () => void
	theme: "emerald" | "cyan"
	title: string
}): JSX.Element {
	return (
		<div className="flex items-center gap-1.5 px-1">
			<span className="text-[10px] uppercase tracking-widest text-neutral-600 mx-2">{label}</span>
			<button
				type="button"
				role="switch"
				aria-checked={enabled}
				onClick={onToggle}
				className={`relative h-6 w-10 cursor-pointer rounded-full border transition-colors ${
					enabled
						? theme === "emerald"
							? "border-emerald-400/60 bg-emerald-400/90"
							: "border-cyan-400/60 bg-cyan-400/90"
						: "border-white/10 bg-neutral-800"
				}`}
				title={title}
			>
				<span
					className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
						enabled ? "translate-x-[1px]" : "-translate-x-[19px]"
					}`}
				/>
			</button>
		</div>
	)
}

function RunSettingsGroup({
	label,
	children
}: {
	label: string
	children: ReactNode
}): JSX.Element {
	return (
		<div className="mb-3 last:mb-0">
			<div className="mb-1.5 text-[10px] uppercase tracking-widest text-neutral-600">{label}</div>
			<div className="flex flex-wrap gap-1.5">{children}</div>
		</div>
	)
}

function SpeedButton({
	active,
	label,
	onClick
}: {
	active: boolean
	label: string
	onClick: () => void
}): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
				active
					? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
					: "border-white/5 bg-white/[0.02] text-neutral-500 hover:border-white/10 hover:text-neutral-300"
			}`}
		>
			{label}
		</button>
	)
}
