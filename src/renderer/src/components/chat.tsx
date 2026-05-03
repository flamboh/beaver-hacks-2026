import type { CSSProperties, FormEvent, JSX, KeyboardEvent, RefObject, UIEvent } from "react"
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
	useSyncExternalStore
} from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, X } from "lucide-react"
import {
	getSemgrepStatus,
	listAgentModels,
	sendAgentMessage,
	stopAgentMessage
} from "../agentStore"
import type { AgentSnapshot } from "../../../main/agent/ipc"
import type { ComposerMentionSuggestion } from "../../../main/composer/ipc"
import { AgentRunSettings } from "./AgentRunSettings"
import { StreamingDots, TranscriptBlockView } from "./ChatTranscript"
import { buildTranscript } from "./chatTranscriptModel"
import {
	activeComposerToken,
	fuzzyIncludes,
	replaceComposerToken,
	type ComposerSuggestion
} from "./chatComposerSyntax"

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

function scrollToBottom(element: HTMLElement | null): void {
	if (element) element.scrollTop = element.scrollHeight
}

function useAutoFollowTranscript(scrollRef: RefObject<HTMLElement | null>, version: string): void {
	const subscribe = useCallback(
		(listener: () => void) => {
			const frame = requestAnimationFrame(() => {
				listener()
				requestAnimationFrame(() => scrollToBottom(scrollRef.current))
			})
			return () => cancelAnimationFrame(frame)
		},
		[scrollRef]
	)
	const getSnapshot = useCallback(() => version, [version])
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
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
}

export interface ChatHandle {
	focusComposer: () => void
}

export const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
	{
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
		provider
	}: ChatProps,
	ref
): JSX.Element {
	const [draft, setDraft] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [isCancelling, setIsCancelling] = useState(false)
	const [planningMode, setPlanningMode] = useState(false)
	const [securityMode, setSecurityMode] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [cursor, setCursor] = useState(0)
	const [suggestionIndex, setSuggestionIndex] = useState(0)
	const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)
	const transcriptViewportRef = useRef<HTMLDivElement | null>(null)
	const inputRef = useRef<HTMLTextAreaElement | null>(null)
	const transcriptScrollRef = useRef<HTMLElement | null>(null)
	useImperativeHandle(
		ref,
		() => ({
			focusComposer: () => inputRef.current?.focus()
		}),
		[]
	)
	const transcript = thread ? buildTranscript(thread) : []
	const transcriptVersion = thread
		? `${thread.updatedAt}:${thread.messages.length}:${thread.activities.length}`
		: ""
	useAutoFollowTranscript(transcriptScrollRef, transcriptVersion)
	const lastBlock = transcript.at(-1)
	const isAwaitingAssistant =
		(isSending || isRunning) && (!lastBlock || lastBlock.kind === "user" || !lastBlock.streaming)
	const activeToken = activeComposerToken(draft, Math.min(cursor || draft.length, draft.length))
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
	const secureBlockMessage = `Security mode requires Semgrep CLI (${semgrepStatus?.command ?? "semgrep"} not found). Install it with brew install semgrep or python3 -m pip install semgrep, then retry.`
	const suggestions = semgrepUnavailable
		? []
		: buildSuggestions(activeToken, fileSuggestions, mentionSuggestions)
	const selectedSuggestionIndex =
		suggestions.length === 0 ? 0 : suggestionIndex % suggestions.length
	const canSend = draft.trim().length > 0 && !isSending && !isRunning && !semgrepUnavailable
	const canCancel = isRunning && !isCancelling
	const autoScrollKey = thread?.updatedAt ?? "idle"

	function scrollAnchorRef(node: HTMLDivElement | null): void {
		if (!node) return
		if (!isPinnedToBottom) return
		const viewport = transcriptViewportRef.current
		if (!viewport) return
		viewport.scrollTop = viewport.scrollHeight
	}

	function handleTranscriptScroll(event: UIEvent<HTMLDivElement>): void {
		const target = event.currentTarget
		const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight
		setIsPinnedToBottom(distanceFromBottom < 24)
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const prompt = draft.trim()
		if (!prompt || isSending || isRunning || semgrepUnavailable) return

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
			.then(() => onMessageSent?.(prompt).catch(() => undefined))
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause))
				setDraft(prompt)
			})
			.finally(() => setIsSending(false))
	}

	function handleCancel(): void {
		if (!canCancel) return

		setError(null)
		setIsCancelling(true)
		void stopAgentMessage(thread?.id ?? threadId)
			.catch((cause: unknown) => {
				setError(cause instanceof Error ? cause.message : String(cause))
			})
			.finally(() => setIsCancelling(false))
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
				ref={transcriptScrollRef}
				data-selectable-text
				data-scroll-boundary-stop="true"
				className="nowheel nodrag min-h-0 flex-1 select-text overflow-y-auto px-4 py-5"
				onScroll={handleTranscriptScroll}
			>
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{thread ? (
						<>
							{transcript.map((block) => (
								<TranscriptBlockView key={block.id} block={block} />
							))}
							<AnimatePresence initial={false}>
								{isAwaitingAssistant ? (
									<motion.article
										key="pending"
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -2 }}
										transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
										className="mr-auto flex max-w-[86%] flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
										aria-live="polite"
										aria-label="Agent is thinking"
									>
										<StreamingDots />
										{thread?.reasoningPreview ? (
											<p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-zinc-500">
												{thread.reasoningPreview}
											</p>
										) : null}
									</motion.article>
								) : null}
							</AnimatePresence>
						</>
					) : (
						<motion.div
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
							className="mt-24 text-center"
						>
							<h2 className="text-lg font-medium text-zinc-100">Ask Agent</h2>
							<p className="mt-2 text-sm text-zinc-500">Send a message to start the loop.</p>
						</motion.div>
					)}
					<div key={`scroll-anchor:${autoScrollKey}`} ref={scrollAnchorRef} />
				</div>
			</section>

			<footer className="nodrag shrink-0 cursor-default p-4">
				<form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
					<div className="relative">
						<AnimatePresence initial={false}>
							{suggestions.length > 0 ? (
								<motion.div
									key="suggestions"
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 4 }}
									transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
									className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full overflow-hidden rounded-lg border border-white/10 bg-[#111114] p-1 shadow-2xl shadow-black/50"
								>
									{suggestions.map((suggestion, index) => (
										<button
											key={suggestion.id}
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={() => insertSuggestion(suggestion)}
											className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
												index === selectedSuggestionIndex
													? "bg-white/10 text-zinc-100"
													: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
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
								</motion.div>
							) : null}
						</AnimatePresence>

						<div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] transition-[border-color,box-shadow,background-color] duration-150 ease-out focus-within:border-blue-400/40 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_1px_rgba(96,165,250,0.18)]">
							{semgrepUnavailable ? (
								<div className="min-h-[44px] px-4 pt-3 pb-1 text-sm leading-6 text-cyan-200">
									{secureBlockMessage}
								</div>
							) : (
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
									style={{ fieldSizing: "content" } as CSSProperties}
									className="block max-h-[220px] min-h-[44px] w-full resize-none rounded-2xl bg-transparent px-4 pt-3 pb-1 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
								/>
							)}
							<div className="flex items-center justify-between gap-2 px-2 pb-2">
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
								<motion.button
									type={isRunning ? "button" : "submit"}
									onClick={isRunning ? handleCancel : undefined}
									disabled={isRunning ? !canCancel : !canSend}
									aria-label={isRunning ? "Cancel message" : "Send message"}
									title={isRunning ? "Cancel message" : "Send message"}
									whileHover={isRunning ? { scale: 1.02 } : canSend ? { scale: 1.06 } : undefined}
									whileTap={isRunning || canSend ? { scale: 0.92 } : undefined}
									animate={{
										backgroundColor: isRunning
											? "rgb(244 244 245)"
											: canSend
												? "rgb(59 130 246)"
												: "rgba(255,255,255,0.08)",
										color: isRunning
											? "rgb(9 9 11)"
											: canSend
												? "rgb(255 255 255)"
												: "rgb(113 113 122)"
									}}
									transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.6 }}
									className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-xs font-medium shadow-[0_4px_14px_-4px_rgba(59,130,246,0.55)] outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:cursor-not-allowed disabled:shadow-none"
								>
									{isRunning ? (
										<X size={16} strokeWidth={2.75} />
									) : (
										<ArrowUp size={15} strokeWidth={2.75} />
									)}
								</motion.button>
							</div>
						</div>
					</div>
					<AnimatePresence initial={false}>
						{error ? (
							<motion.p
								key="error"
								initial={{ opacity: 0, y: -2 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -2 }}
								transition={{ duration: 0.15 }}
								className="mt-2 text-xs text-red-400"
							>
								{error}
							</motion.p>
						) : null}
					</AnimatePresence>
				</form>
			</footer>
		</div>
	)
})

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
