import type { FormEvent, JSX } from "react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { getSemgrepStatus, listAgentModels, sendAgentMessage } from "../agentStore"
import type { AgentSnapshot } from "../../../main/agent/ipc"
import { AgentRunSettings } from "./AgentRunSettings"
import { TranscriptBlockView } from "./ChatTranscript"
import { buildTranscript } from "./chatTranscriptModel"
import { GitBranchControls } from "./GitBranchControls"

type AgentThread = AgentSnapshot["threads"][number]
type AgentProvider = AgentThread["provider"]
type ModelOption = Awaited<ReturnType<typeof listAgentModels>>[number]

const FALLBACK_MODELS: Record<AgentProvider, ModelOption[]> = {
	codex: [
		{
			id: "gpt-5.5",
			label: "GPT-5.5",
			provider: "codex",
			isDefault: true,
			reasoningEfforts: [],
			speedTiers: []
		}
	],
	claude: [
		{
			id: "claude-opus-4-7",
			label: "Claude Opus 4.7",
			provider: "claude",
			isDefault: false,
			reasoningEfforts: [],
			speedTiers: []
		},
		{
			id: "claude-sonnet-4-6",
			label: "Claude Sonnet 4.6",
			provider: "claude",
			isDefault: true,
			reasoningEfforts: [],
			speedTiers: []
		},
		{
			id: "claude-haiku-4-5",
			label: "Claude Haiku 4.5",
			provider: "claude",
			isDefault: false,
			reasoningEfforts: [],
			speedTiers: []
		}
	]
}

interface ChatProps {
	thread: AgentThread | null
	threadId: string
	isRunning: boolean
	cwd: string
	model?: string
	runtimeModel?: string | null
	effort?: string
	speedTier?: string | null
	onModelChange?: (model: string) => void
	onEffortChange?: (effort: string) => void
	onSpeedTierChange?: (speedTier: string | null) => void
	onFirstMessage?: (prompt: string) => Promise<void>
	provider?: AgentThread["provider"]
	workspaceId: string
}

export function Chat({
	thread,
	threadId,
	isRunning,
	cwd,
	model,
	runtimeModel,
	effort,
	speedTier,
	onModelChange,
	onEffortChange,
	onSpeedTierChange,
	onFirstMessage,
	provider,
	workspaceId
}: ChatProps): JSX.Element {
	const [draft, setDraft] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [planningMode, setPlanningMode] = useState(false)
	const [securityMode, setSecurityMode] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [branchOpen, setBranchOpen] = useState(false)
	const canSend = draft.trim().length > 0 && !isSending && !isRunning
	const transcript = thread ? buildTranscript(thread) : []
	const { data: modelOptions = [] } = useQuery({
		queryKey: ["agent-models", provider],
		queryFn: () => listAgentModels(provider ?? "codex"),
		enabled: Boolean(provider),
		staleTime: 5 * 60 * 1000
	})
	const { data: semgrepStatus } = useQuery({
		queryKey: ["agent-semgrep-status"],
		queryFn: getSemgrepStatus,
		staleTime: 60 * 1000
	})
	const visibleModelOptions =
		modelOptions.length > 0 ? modelOptions : FALLBACK_MODELS[provider ?? "codex"]
	const defaultModel =
		visibleModelOptions.find((option) => option.isDefault)?.id ?? visibleModelOptions[0]?.id
	const selectedModel = visibleModelOptions.some((option) => option.id === model)
		? (model ?? "")
		: (defaultModel ?? model ?? "")
	const selectedModelOption = visibleModelOptions.find((option) => option.id === selectedModel)
	const effortOptions = selectedModelOption?.reasoningEfforts ?? []
	const selectedEffort =
		effortOptions.find((option) => option.id === effort)?.id ??
		effortOptions.find((option) => option.isDefault)?.id ??
		effortOptions[0]?.id
	const selectedSpeedTier = (selectedModelOption?.speedTiers ?? []).some(
		(option) => option.id === speedTier
	)
		? speedTier
		: null
	const semgrepUnavailable =
		securityMode && semgrepStatus !== undefined && semgrepStatus.available === false
	const autoScrollKey = thread?.updatedAt ?? "idle"

	function scrollAnchorRef(node: HTMLDivElement | null): void {
		if (!node) return
		node.scrollIntoView({ block: "end" })
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const prompt = draft.trim()
		if (!prompt || isSending || isRunning) return
		if (semgrepUnavailable) {
			setError("Security mode requires Semgrep CLI. Install Semgrep and retry.")
			return
		}

		setDraft("")
		setError(null)
		setIsSending(true)
		void Promise.resolve()
			.then(() => (thread ? undefined : onFirstMessage?.(prompt)))
			.then(() =>
				sendAgentMessage({
					prompt,
					cwd,
					threadId: thread?.id ?? threadId,
					...(thread || !provider ? {} : { provider }),
					...(selectedModel ? { model: selectedModel } : {}),
					...(selectedEffort ? { effort: selectedEffort } : {}),
					...(selectedSpeedTier ? { speedTier: selectedSpeedTier } : {}),
					...(planningMode ? { planningMode: true } : {}),
					...(securityMode ? { securityMode: true } : {})
				})
			)
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause))
				setDraft(prompt)
			})
			.finally(() => setIsSending(false))
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<section
				data-selectable-text
				className="nowheel nodrag min-h-0 flex-1 select-text overflow-y-auto px-4 py-5"
			>
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{thread ? (
						transcript.map((block) => <TranscriptBlockView key={block.id} block={block} />)
					) : (
						<div className="mt-24 text-center">
							<h2 className="text-lg font-medium text-zinc-100">Ask Agent</h2>
							<p className="mt-2 text-sm text-zinc-500">Send a message to start the loop.</p>
						</div>
					)}
					<div key={`scroll-anchor:${autoScrollKey}`} ref={scrollAnchorRef} />
				</div>
			</section>

			<footer className="nodrag shrink-0 cursor-default border-t border-white/10 bg-[#0c0c0f] p-4">
				<form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
					<textarea
						value={draft}
						onChange={(event) => setDraft(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.currentTarget.form?.requestSubmit()
								event.preventDefault()
							}
						}}
						rows={1}
						placeholder="Message agent..."
						className="h-12 flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/20"
					/>
					<button
						type="submit"
						disabled={!canSend}
						className="h-12 cursor-pointer rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				</form>
				<div className="mx-auto mt-2 flex max-w-3xl items-start justify-between gap-3">
					<button
						type="button"
						onClick={() => setBranchOpen((v) => !v)}
						className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-600 transition-colors duration-150 hover:text-neutral-400"
					>
						<ChevronDown
							size={12}
							className={`transition-transform duration-200 ${branchOpen ? "rotate-180" : ""}`}
						/>
						Branch
					</button>
					<AgentRunSettings
						modelOptions={visibleModelOptions}
						selectedModel={selectedModel}
						runtimeModel={runtimeModel}
						effort={effort}
						speedTier={speedTier}
						planningMode={planningMode}
						securityMode={securityMode}
						onModelChange={onModelChange}
						onEffortChange={onEffortChange}
						onSpeedTierChange={onSpeedTierChange}
						onPlanningModeChange={setPlanningMode}
						onSecurityModeChange={setSecurityMode}
					/>
				</div>
				<div className="mx-auto max-w-3xl">
					<div
						className="overflow-hidden transition-[max-height] duration-200"
						style={{ maxHeight: branchOpen ? 200 : 0 }}
					>
						<div className="pt-2">
							<GitBranchControls workspaceId={workspaceId} />
						</div>
					</div>
				</div>
				{semgrepUnavailable ? (
					<p className="mx-auto mt-2 max-w-3xl rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
						Security mode requires Semgrep CLI (`{semgrepStatus?.command ?? "semgrep"}` not found).
						Install it with `brew install semgrep` or `python3 -m pip install semgrep`, then retry.
					</p>
				) : null}
				{error ? <p className="mx-auto mt-2 max-w-3xl text-xs text-red-400">{error}</p> : null}
			</footer>
		</div>
	)
}
