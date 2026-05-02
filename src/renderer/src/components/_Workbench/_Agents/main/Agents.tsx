import { useState } from "react"
import { X, Plus, FolderOpen, AlignLeft } from "lucide-react"
import { Agent } from "@renderer/types/models"

// ── placeholder data ──────────────────────────────────────────────
const PLACEHOLDER_AGENTS: Agent[] = [
	{
		id: "1",
		name: "Auth Refactor",
		project_id: "proj-1",
		model: "claude-opus-4-7",
		scope_path: "@Pipeline.md",
		effort: "high"
	},
	{
		id: "2",
		name: "Test Coverage",
		project_id: "proj-1",
		model: "gpt-4o-mini",
		scope_path: "@tests/README.md",
		effort: "medium"
	},
	{
		id: "3",
		name: "Docs Generator",
		project_id: "proj-1",
		model: "claude-sonnet-4-6",
		scope_path: "",
		effort: "low"
	}
]

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

const EFFORT_STYLES: Record<string, string> = {
	low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	medium: "bg-yellow-500/15  text-yellow-400  border-yellow-500/30",
	high: "bg-red-500/15     text-red-400     border-red-500/30"
}

const DEFAULT_FORM = {
	name: "",
	model: "claude-sonnet-4-6",
	effort: "medium" as (typeof EFFORT_OPTIONS)[number],
	instructionMode: "text" as "text" | "path",
	instructions: "",
	scopePath: ""
}
// ─────────────────────────────────────────────────────────────────

export default function Agents() {
	const [agents, setAgents] = useState<Agent[]>(PLACEHOLDER_AGENTS)
	const [showForm, setShowForm] = useState(false)
	const [form, setForm] = useState({ ...DEFAULT_FORM })
	const [submitting, setSubmitting] = useState(false)

	const set = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) =>
		setForm((prev) => ({ ...prev, [key]: value }))

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setSubmitting(true)
		// simulate DB write
		await new Promise((res) => setTimeout(res, 900))
		const newAgent: Agent = {
			id: crypto.randomUUID(),
			name: form.name || "Unnamed Agent",
			project_id: "proj-1",
			model: form.model,
			scope_path: form.instructionMode === "path" ? form.scopePath : "",
			effort: form.effort
		}
		setAgents((prev) => [newAgent, ...prev])
		setSubmitting(false)
		setShowForm(false)
		setForm({ ...DEFAULT_FORM })
	}

	const handleClose = () => {
		setShowForm(false)
		setForm({ ...DEFAULT_FORM })
	}

	return (
		<div className="flex h-full overflow-hidden">
			{/* main list */}
			<div className="flex flex-col flex-1 overflow-auto">
				{/* header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-base font-semibold text-white">Agents</h2>
						<p className="text-xs text-neutral-500 mt-0.5">{agents.length} configured</p>
					</div>
					<button
						onClick={() => setShowForm(true)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/8 hover:bg-white/12 border border-white/10 text-sm text-white transition-colors duration-150"
					>
						<Plus size={14} />
						New Agent
					</button>
				</div>

				{/* agent cards */}
				{agents.length === 0 ? (
					<div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
						No agents yet. Create one to get started.
					</div>
				) : (
					<div className="flex flex-col gap-2">
						{agents.map((agent) => (
							<div
								key={agent.id}
								className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/5 bg-neutral-900 hover:border-white/10 transition-colors duration-150"
							>
								<div className="flex flex-col gap-0.5">
									<span className="text-sm font-medium text-neutral-100">{agent.name}</span>
									<span className="text-xs text-neutral-500 font-mono">{agent.model}</span>
									{agent.scope_path && (
										<span className="text-xs text-blue-400/70 font-mono">{agent.scope_path}</span>
									)}
								</div>
								<span
									className={`text-[11px] px-2 py-0.5 rounded-md border capitalize ${EFFORT_STYLES[agent.effort]}`}
								>
									{agent.effort}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* slide-in form panel */}
			<div
				className={`flex flex-col shrink-0 w-[360px] ml-6 transition-all duration-250 ease-in-out overflow-hidden
          ${showForm ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none w-0 ml-0"}`}
			>
				<form
					onSubmit={handleSubmit}
					className="flex flex-col h-full rounded-xl border border-white/8 bg-neutral-900 overflow-hidden"
					style={{ minWidth: 360 }}
				>
					{/* form header */}
					<div className="flex items-center justify-between px-4 h-11 border-b border-white/5 bg-neutral-800/40 shrink-0">
						<span className="text-sm font-medium text-white">New Agent</span>
						<button
							type="button"
							onClick={handleClose}
							className="text-neutral-500 hover:text-white transition-colors"
						>
							<X size={15} />
						</button>
					</div>

					<div className="flex flex-col gap-5 px-4 py-5 overflow-auto flex-1">
						{/* name */}
						<Field label="Agent Name">
							<input
								type="text"
								placeholder="e.g. Auth Refactor"
								value={form.name}
								onChange={(e) => set("name", e.target.value)}
								className="w-full bg-neutral-800/60 border border-white/8 rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 transition-colors"
							/>
						</Field>

						{/* model */}
						<Field label="Model">
							<select
								value={form.model}
								onChange={(e) => set("model", e.target.value)}
								className="w-full bg-neutral-800/60 border border-white/8 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors appearance-none"
							>
								{MODEL_OPTIONS.map((group) => (
									<optgroup key={group.group} label={group.group}>
										{group.models.map((m) => (
											<option key={m.value} value={m.value}>
												{m.label}
											</option>
										))}
									</optgroup>
								))}
							</select>
						</Field>

						{/* effort */}
						<Field label="Effort Level">
							<div className="flex gap-1.5">
								{EFFORT_OPTIONS.map((level) => (
									<button
										key={level}
										type="button"
										onClick={() => set("effort", level)}
										className={`flex-1 py-1.5 rounded-md text-xs capitalize border transition-colors duration-150
                      ${
												form.effort === level
													? EFFORT_STYLES[level]
													: "border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10"
											}`}
									>
										{level}
									</button>
								))}
							</div>
						</Field>

						{/* instructions */}
						<Field label="Instructions">
							{/* mode toggle */}
							<div className="flex mb-2 rounded-md border border-white/5 overflow-hidden">
								<button
									type="button"
									onClick={() => set("instructionMode", "text")}
									className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors duration-150
                    ${form.instructionMode === "text" ? "bg-white/8 text-white" : "text-neutral-600 hover:text-neutral-400"}`}
								>
									<AlignLeft size={12} /> Describe
								</button>
								<button
									type="button"
									onClick={() => set("instructionMode", "path")}
									className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors duration-150
                    ${form.instructionMode === "path" ? "bg-white/8 text-white" : "text-neutral-600 hover:text-neutral-400"}`}
								>
									<FolderOpen size={12} /> File Path
								</button>
							</div>

							{form.instructionMode === "text" ? (
								<textarea
									rows={5}
									placeholder="Describe what this agent should accomplish..."
									value={form.instructions}
									onChange={(e) => set("instructions", e.target.value)}
									className="w-full bg-neutral-800/60 border border-white/8 rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
								/>
							) : (
								<input
									type="text"
									placeholder="./docs/agent-scope.md"
									value={form.scopePath}
									onChange={(e) => set("scopePath", e.target.value)}
									className="w-full bg-neutral-800/60 border border-white/8 rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-600 font-mono focus:outline-none focus:border-white/20 transition-colors"
								/>
							)}
						</Field>
					</div>

					{/* submit */}
					<div className="px-4 py-4 border-t border-white/5 shrink-0">
						<button
							type="submit"
							disabled={submitting}
							className="w-full py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/10 text-sm text-white font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{submitting ? (
								<>
									<span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
									Saving...
								</>
							) : (
								"Create Agent"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
				{label}
			</label>
			{children}
		</div>
	)
}
