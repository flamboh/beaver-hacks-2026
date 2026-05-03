import type { FormEvent, JSX, KeyboardEvent } from "react"
import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { listAgentModels, sendAgentMessage } from "../agentStore"
import type { AgentSnapshot } from "../../../main/agent/ipc"
import type { ComposerMentionSuggestion } from "../../../main/composer/ipc"
import { AgentRunSettings } from "./AgentRunSettings"
import { TranscriptBlockView } from "./ChatTranscript"
import { buildTranscript } from "./chatTranscriptModel"
import {
	activeComposerToken,
	fuzzyIncludes,
	replaceComposerToken,
	type ComposerSuggestion
} from "./chatComposerSyntax"
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
	onMessageSent?: (prompt: string) => Promise<void>
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
	onMessageSent,
	onEffortChange,
	onSpeedTierChange,
	onFirstMessage,
	provider,
	workspaceId
}: ChatProps): JSX.Element {
	const [draft, setDraft] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [branchOpen, setBranchOpen] = useState(false)
	const [cursor, setCursor] = useState(0)
	const [suggestionIndex, setSuggestionIndex] = useState(0)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)
	const canSend = draft.trim().length > 0 && !isSending && !isRunning
	const transcript = thread ? buildTranscript(thread) : []
	const activeToken = activeComposerToken(draft, Math.min(cursor || draft.length, draft.length))
	const { data: modelOptions = [] } = useQuery({
		queryKey: ["agent-models", provider],
		queryFn: () => listAgentModels(provider ?? "codex"),
		enabled: Boolean(provider),
		staleTime: 5 * 60 * 1000
	})
	const { data: fileSuggestions = [] } = useQuery({
		queryKey: ["composer-files", cwd, activeToken?.kind === "file" ? activeToken.query : ""],
		queryFn: () =>
			window.api.composer.searchFiles({
				cwd,
				query: activeToken?.kind === "file" ? activeToken.query : ""
			}),
		enabled: activeToken?.kind === "file",
		staleTime: 5_000
	})
	const { data: mentionSuggestions = [] } = useQuery({
		queryKey: ["composer-mentions", cwd],
		queryFn: () => window.api.composer.listMentions(cwd),
		staleTime: 30_000
	})
	const suggestions = buildSuggestions(activeToken, fileSuggestions, mentionSuggestions)
	const selectedSuggestionIndex =
		suggestions.length === 0 ? 0 : suggestionIndex % suggestions.length
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

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const prompt = draft.trim()
		if (!prompt || isSending || isRunning) return

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
					...(selectedSpeedTier ? { speedTier: selectedSpeedTier } : {})
				})
			)
			.then(() => onMessageSent?.(prompt).catch(() => undefined))
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause))
				setDraft(prompt)
			})
			.finally(() => setIsSending(false))
	}

	function syncCursor(element: HTMLTextAreaElement): void {
		setCursor(element.selectionStart)
	}

	function insertSuggestion(suggestion: ComposerSuggestion): void {
		if (!activeToken) return
		const next = replaceComposerToken(draft, activeToken, suggestion.insertText)
		setDraft(next.text)
		setCursor(next.cursor)
		setSuggestionIndex(0)
		window.requestAnimationFrame(() => {
			inputRef.current?.focus()
			inputRef.current?.setSelectionRange(next.cursor, next.cursor)
		})
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (suggestions.length > 0) {
			if (event.key === "ArrowDown") {
				event.preventDefault()
				setSuggestionIndex((index) => (index + 1) % suggestions.length)
				return
			}
			if (event.key === "ArrowUp") {
				event.preventDefault()
				setSuggestionIndex((index) => (index + suggestions.length - 1) % suggestions.length)
				return
			}
			if (event.key === "Tab") {
				event.preventDefault()
				insertSuggestion(suggestions[selectedSuggestionIndex])
				return
			}
		}

		if (event.key === "Enter" && !event.shiftKey) {
			if (suggestions.length > 0) {
				event.preventDefault()
				insertSuggestion(suggestions[selectedSuggestionIndex])
				return
			}
			event.currentTarget.form?.requestSubmit()
			event.preventDefault()
		}
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
				</div>
			</section>

			<footer className="nodrag shrink-0 cursor-default border-t border-white/10 bg-[#0c0c0f] p-4">
				<form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
					<div className="relative flex-1">
						{suggestions.length > 0 ? (
							<div className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full overflow-hidden rounded-lg border border-white/10 bg-[#111114] p-1 shadow-2xl shadow-black/50">
								{suggestions.map((suggestion, index) => (
									<button
										key={suggestion.id}
										type="button"
										onMouseDown={(event) => event.preventDefault()}
										onClick={() => insertSuggestion(suggestion)}
										className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
											index === selectedSuggestionIndex
												? "bg-white/10 text-zinc-100"
												: "text-zinc-400 hover:bg-white/6 hover:text-zinc-100"
										}`}
									>
										<span className="min-w-0 truncate">{suggestion.label}</span>
										{suggestion.detail ? (
											<span className="max-w-56 shrink truncate text-xs text-zinc-600">
												{suggestion.detail}
											</span>
										) : null}
									</button>
								))}
							</div>
						) : null}
						<textarea
							ref={inputRef}
							value={draft}
							onChange={(event) => {
								setDraft(event.currentTarget.value)
								syncCursor(event.currentTarget)
								setSuggestionIndex(0)
							}}
							onSelect={(event) => syncCursor(event.currentTarget)}
							onClick={(event) => syncCursor(event.currentTarget)}
							onKeyUp={(event) => syncCursor(event.currentTarget)}
							onKeyDown={handleKeyDown}
							rows={1}
							placeholder="Message agent..."
							className="h-12 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/20"
						/>
					</div>
					<button
						type="submit"
						disabled={!canSend}
						className="h-12 cursor-pointer rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				</form>
				<div className="mx-auto mt-3 flex max-w-3xl items-start justify-between gap-3">
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
						onModelChange={onModelChange}
						onEffortChange={onEffortChange}
						onSpeedTierChange={onSpeedTierChange}
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
				{error ? <p className="mx-auto mt-2 max-w-3xl text-xs text-red-400">{error}</p> : null}
			</footer>
		</div>
	)
}

function buildSuggestions(
	token: ReturnType<typeof activeComposerToken>,
	files: { path: string; name: string }[],
	mentions: ComposerMentionSuggestion[]
): ComposerSuggestion[] {
	if (!token) return []

	if (token.kind === "file") {
		return files.map((file) => ({
			id: `file:${file.path}`,
			label: file.path,
			detail: file.name === file.path ? null : file.name,
			insertText: file.path
		}))
	}

	return mentions
		.filter((mention) => fuzzyIncludes(mention.name, token.query))
		.slice(0, 24)
		.map((mention) => ({
			id: `${mention.kind}:${mention.path}`,
			label: `/${mention.name}`,
			detail: mention.description,
			insertText: `$${mention.name}`
		}))
}
