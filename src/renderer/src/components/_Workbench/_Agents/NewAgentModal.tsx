import { type FormEvent, type ReactNode, useState } from "react"
import { AlignLeft, ChevronDown, FolderOpen, X } from "lucide-react"

const MODEL_OPTIONS: { group: string; models: { value: string; label: string }[] }[] = [
	{
		group: "Anthropic",
		models: [
			{ value: "claude-opus-4-7", label: "Claude Opus 4.7" },
			{ value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
			{ value: "claude-haiku-4-5", label: "Claude Haiku 4.5" }
		]
	},
	{
		group: "OpenAI",
		models: [
			{ value: "gpt-4o", label: "GPT-4o" },
			{ value: "gpt-4o-mini", label: "GPT-4o mini" },
			{ value: "o3", label: "o3" },
			{ value: "o4-mini", label: "o4-mini" }
		]
	}
]

const EFFORT_OPTIONS = ["low", "medium", "high"] as const

const EFFORT_STYLES: Record<(typeof EFFORT_OPTIONS)[number], string> = {
	low: "border-white/10 bg-white/8 text-neutral-200",
	medium: "border-white/10 bg-white/8 text-neutral-200",
	high: "border-white/10 bg-white/8 text-neutral-200"
}

const DEFAULT_FORM = {
	name: "",
	model: "claude-sonnet-4-6",
	effort: "medium" as (typeof EFFORT_OPTIONS)[number],
	instructionMode: "text" as "text" | "path",
	instructions: "",
	scopeFileName: "",
	scopePath: ""
}

export type NewAgentInput = typeof DEFAULT_FORM

type NewAgentModalProps = {
	onCancel: () => void
	onSubmit: (input: NewAgentInput) => Promise<unknown>
	projectPath: string
	initialAgent?: {
		name: string
		model: string
		effort: string
		scope_path: string
	}
}

export default function NewAgentModal({
	onCancel,
	onSubmit,
	projectPath,
	initialAgent
}: NewAgentModalProps) {
	const isEditing = Boolean(initialAgent)
	const [form, setForm] = useState<NewAgentInput>({
		...DEFAULT_FORM,
		name: initialAgent?.name ?? DEFAULT_FORM.name,
		model: initialAgent?.model ?? DEFAULT_FORM.model,
		effort: (initialAgent?.effort ?? DEFAULT_FORM.effort) as NewAgentInput["effort"],
		instructionMode: initialAgent ? "path" : DEFAULT_FORM.instructionMode,
		scopePath: initialAgent?.scope_path ?? DEFAULT_FORM.scopePath
	})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const set = <K extends keyof NewAgentInput>(key: K, value: NewAgentInput[K]) =>
		setForm((prev) => ({ ...prev, [key]: value }))

	const scopePathFromFileName = `./scopes/${form.scopeFileName.trim() || "agent-scope"}.md`

	async function handleBrowse(): Promise<void> {
		const selectedPath = await window.api.dialog.selectFile()
		if (selectedPath) set("scopePath", selectedPath)
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault()
		setIsSubmitting(true)
		const savedScope =
			form.instructionMode === "text"
				? await window.api.files.saveScopeFile({
						projectPath,
						fileName: form.scopeFileName || "agent-scope",
						contents: form.instructions
					})
				: null
		await onSubmit({
			...form,
			scopePath:
				form.instructionMode === "text"
					? (savedScope?.relativePath ?? scopePathFromFileName)
					: form.scopePath
		})
		setIsSubmitting(false)
		onCancel()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 text-white">
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-agent-title"
				className="flex max-h-[calc(100vh-48px)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl"
			>
				<header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-neutral-800/40 px-4">
					<h2 id="new-agent-title" className="text-sm font-medium text-white">
						{isEditing ? "Edit Agent" : "New Agent"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						disabled={isSubmitting}
						className="cursor-pointer text-neutral-500 transition-colors duration-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={isEditing ? "Close edit agent modal" : "Close new agent modal"}
					>
						<X size={15} />
					</button>
				</header>

				<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
					<div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-5">
						<Field label="Agent Name">
							<input
								type="text"
								placeholder="e.g. Auth Refactor"
								value={form.name}
								onChange={(event) => set("name", event.target.value)}
								disabled={isSubmitting}
								className="w-full rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 text-sm text-white transition-colors duration-300 placeholder:text-neutral-600 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</Field>

						<Field label="Model">
							<div className="relative">
								<select
									value={form.model}
									onChange={(event) => set("model", event.target.value)}
									disabled={isSubmitting}
									className="cursor-pointer w-full appearance-none rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 pr-9 text-sm text-white transition-colors duration-300 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
								>
									{MODEL_OPTIONS.map((group) => (
										<optgroup key={group.group} label={group.group}>
											{group.models.map((model) => (
												<option key={model.value} value={model.value}>
													{model.label}
												</option>
											))}
										</optgroup>
									))}
								</select>
								<ChevronDown
									size={14}
									className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
								/>
							</div>
						</Field>

						<Field label="Effort Level">
							<div className="grid grid-cols-3 gap-1.5">
								{EFFORT_OPTIONS.map((level) => (
									<button
										key={level}
										type="button"
										onClick={() => set("effort", level)}
										disabled={isSubmitting}
										className={`cursor-pointer rounded-md border py-1.5 text-xs capitalize transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
											form.effort === level
												? EFFORT_STYLES[level]
												: "border-white/5 text-neutral-600 hover:border-white/10 hover:text-neutral-400"
										}`}
									>
										{level}
									</button>
								))}
							</div>
						</Field>

						<Field label="Scope">
							<div className="mb-2 grid grid-cols-2 overflow-hidden rounded-md border border-white/5">
								<button
									type="button"
									onClick={() => set("instructionMode", "text")}
									disabled={isSubmitting}
									className={`flex cursor-pointer items-center justify-center gap-1.5 py-1.5 text-xs transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
										form.instructionMode === "text"
											? "bg-white/8 text-white"
											: "text-neutral-600 hover:text-neutral-400"
									}`}
								>
									<AlignLeft size={12} /> Describe
								</button>
								<button
									type="button"
									onClick={() => set("instructionMode", "path")}
									disabled={isSubmitting}
									className={`flex cursor-pointer items-center justify-center gap-1.5 py-1.5 text-xs transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
										form.instructionMode === "path"
											? "bg-white/8 text-white"
											: "text-neutral-600 hover:text-neutral-400"
									}`}
								>
									<FolderOpen size={12} /> File Path
								</button>
							</div>

							{form.instructionMode === "text" ? (
								<div className="flex flex-col gap-2">
									<textarea
										rows={4}
										placeholder="Describe what this agent should accomplish..."
										value={form.instructions}
										onChange={(event) => set("instructions", event.target.value)}
										disabled={isSubmitting}
										className="w-full resize-none rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 text-sm leading-relaxed text-white transition-colors duration-300 placeholder:text-neutral-600 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
									/>
									<div className="flex items-center gap-2">
										<span className="shrink-0 font-mono text-xs text-neutral-600">scopes/</span>
										<input
											type="text"
											placeholder="agent-scope"
											value={form.scopeFileName}
											onChange={(event) => set("scopeFileName", event.target.value)}
											disabled={isSubmitting}
											className="min-w-0 flex-1 rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 font-mono text-sm text-white transition-colors duration-300 placeholder:text-neutral-600 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
										/>
										<span className="shrink-0 font-mono text-xs text-neutral-600">.md</span>
									</div>
								</div>
							) : (
								<div className="flex gap-2">
									<input
										type="text"
										placeholder="scopes/agent-scope.md"
										value={form.scopePath}
										onChange={(event) => set("scopePath", event.target.value)}
										disabled={isSubmitting}
										className="min-w-0 flex-1 rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 font-mono text-sm text-white transition-colors duration-300 placeholder:text-neutral-600 focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
									/>
									<button
										type="button"
										onClick={handleBrowse}
										disabled={isSubmitting}
										className="cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
									>
										Browse
									</button>
								</div>
							)}
						</Field>
					</div>

					<footer className="flex shrink-0 justify-end gap-2 border-t border-white/5 px-4 py-4">
						<button
							type="button"
							onClick={onCancel}
							disabled={isSubmitting}
							className="cursor-pointer rounded-md border border-white/8 px-4 py-2 text-sm text-neutral-300 transition-colors duration-300 hover:border-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="flex min-w-32 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors duration-300 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSubmitting ? (
								<>
									<span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
									Saving...
								</>
							) : (
								<>{isEditing ? "Save" : "Create Agent"}</>
							)}
						</button>
					</footer>
				</form>
			</section>
		</div>
	)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">
				{label}
			</label>
			{children}
		</div>
	)
}
