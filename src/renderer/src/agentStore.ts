import { useMemo, useSyncExternalStore } from "react"
import type {
	AgentModelOption,
	AgentProvider,
	AgentSnapshot,
	SemgrepStatus
} from "../../main/agent/ipc"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitMessage,
	GitCreateBranchInput,
	GitDiffTour,
	GitPushInput,
	GitReviewFilesInput,
	GitRunStackedActionInput,
	GitRunStackedActionResult,
	GitStackedActionProgressEvent,
	GitStatusSnapshot
} from "../../main/git/ipc"

const EMPTY_SNAPSHOT: AgentSnapshot = {
	threads: [],
	activeThreadId: null,
	updatedAt: ""
}

let snapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()
const gitListeners = new Set<() => void>()
const gitSnapshots = new Map<string, GitStatusSnapshot>()
const watchedGitWorkspaces = new Map<string, { refCount: number; cleanup: () => void }>()
const gitRefreshInFlight = new Map<string, Promise<GitStatusSnapshot>>()
const gitLastRefreshAt = new Map<string, number>()
const GIT_STATUS_REFRESH_INTERVAL_MS = 30_000
const GIT_STATUS_REFRESH_DEBOUNCE_MS = 1_000

function emit(): void {
	for (const listener of listeners) {
		listener()
	}
}

function emitGit(): void {
	for (const listener of gitListeners) {
		listener()
	}
}

function setSnapshot(nextSnapshot: AgentSnapshot): void {
	refreshCompletedThreadGitStatus(snapshot, nextSnapshot)
	snapshot = nextSnapshot
	emit()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	const unsubscribeApi = window.api.agent.onSnapshot(setSnapshot)
	void window.api.agent.getSnapshot().then(setSnapshot)

	return () => {
		listeners.delete(listener)
		unsubscribeApi()
	}
}

function getSnapshot(): AgentSnapshot {
	return snapshot
}

export function useAgentSnapshot(): AgentSnapshot {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function listAgentModels(provider: AgentProvider): Promise<AgentModelOption[]> {
	return window.api.agent.listModels(provider)
}

export function getSemgrepStatus(): Promise<SemgrepStatus> {
	return window.api.agent.getSemgrepStatus()
}

export async function sendAgentMessage(input: {
	prompt: string
	cwd: string
	threadId?: string
	provider?: AgentSnapshot["threads"][number]["provider"]
	model?: string
	effort?: string
	speedTier?: string | null
	planningMode?: boolean
	securityMode?: boolean
}): Promise<AgentSnapshot> {
	const nextSnapshot = await window.api.agent.startTurn({
		...(input.threadId ? { threadId: input.threadId } : {}),
		...(input.provider ? { provider: input.provider } : {}),
		...(input.model ? { model: input.model } : {}),
		...(input.effort ? { effort: input.effort } : {}),
		...(input.speedTier ? { speedTier: input.speedTier } : {}),
		...(input.planningMode ? { planningMode: true } : {}),
		...(input.securityMode ? { securityMode: true } : {}),
		cwd: input.cwd,
		prompt: input.prompt,
		runtimeMode: "full-access"
	})
	setSnapshot(nextSnapshot)
	return nextSnapshot
}

export async function stopAgentMessage(threadId: string): Promise<AgentSnapshot> {
	const nextSnapshot = await window.api.agent.stopTurn({ threadId })
	setSnapshot(nextSnapshot)
	return nextSnapshot
}

export async function spawnAgentThread(input: {
	threadId: string
	cwd: string
	name?: string
	provider?: AgentSnapshot["threads"][number]["provider"]
	model?: string
	runtimeMode?: AgentSnapshot["threads"][number]["runtimeMode"]
	preflight?: boolean
}): Promise<void> {
	const nextSnapshot = await window.api.agent.spawnThread(input)
	setSnapshot(nextSnapshot)
}

export async function findProjectSkills(input: {
	threadId?: string
	cwd?: string
	prompt?: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.findSkills({
		...(input.threadId ? { threadId: input.threadId } : {}),
		...(input.cwd ? { cwd: input.cwd } : {}),
		...(input.prompt ? { prompt: input.prompt } : {}),
		runtimeMode: "full-access"
	})
	setSnapshot(nextSnapshot)
}

export async function findProjectMcps(input: {
	threadId?: string
	cwd?: string
	prompt?: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.findMcps({
		...(input.threadId ? { threadId: input.threadId } : {}),
		...(input.cwd ? { cwd: input.cwd } : {}),
		...(input.prompt ? { prompt: input.prompt } : {}),
		runtimeMode: "full-access"
	})
	setSnapshot(nextSnapshot)
}

export async function installProjectSkill(input: {
	threadId: string
	skillId: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.installSkill(input)
	setSnapshot(nextSnapshot)
}

export async function uninstallProjectSkill(input: {
	threadId: string
	cwd: string
	skillPath: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.uninstallSkill(input)
	setSnapshot(nextSnapshot)
}

function subscribeGit(workspaceId: string, listener: () => void): () => void {
	gitListeners.add(listener)
	if (workspaceId) retainGitWatch(workspaceId)

	return () => {
		gitListeners.delete(listener)
		if (workspaceId) releaseGitWatch(workspaceId)
	}
}

function getGitSnapshot(workspaceId: string): GitStatusSnapshot | null {
	return gitSnapshots.get(workspaceId) ?? null
}

export function useGitStatus(workspaceId: string): GitStatusSnapshot | null {
	const subscribe = useMemo(
		() => (listener: () => void) => subscribeGit(workspaceId, listener),
		[workspaceId]
	)
	const read = useMemo(() => () => getGitSnapshot(workspaceId), [workspaceId])
	return useSyncExternalStore(subscribe, read, read)
}

export async function refreshGitStatus(workspaceId: string): Promise<GitStatusSnapshot> {
	const inFlight = gitRefreshInFlight.get(workspaceId)
	if (inFlight) return inFlight

	const lastRefreshAt = gitLastRefreshAt.get(workspaceId) ?? 0
	if (Date.now() - lastRefreshAt < GIT_STATUS_REFRESH_DEBOUNCE_MS) {
		const cached = gitSnapshots.get(workspaceId)
		if (cached) return cached
	}

	gitLastRefreshAt.set(workspaceId, Date.now())
	const refresh = window.api.git
		.getStatus(workspaceId)
		.then((nextSnapshot) => {
			gitSnapshots.set(workspaceId, nextSnapshot)
			emitGit()
			return nextSnapshot
		})
		.finally(() => gitRefreshInFlight.delete(workspaceId))
	gitRefreshInFlight.set(workspaceId, refresh)
	return refresh
}

export async function checkoutGitBranch(input: GitCheckoutInput): Promise<void> {
	const nextSnapshot = await window.api.git.checkout(input)
	gitSnapshots.set(input.workspaceId, nextSnapshot)
	emitGit()
}

export async function createGitBranch(input: GitCreateBranchInput): Promise<void> {
	const nextSnapshot = await window.api.git.createBranch(input)
	gitSnapshots.set(input.workspaceId, nextSnapshot)
	emitGit()
}

export async function acceptGitFileChanges(input: GitReviewFilesInput): Promise<void> {
	const nextSnapshot = await window.api.git.acceptFiles(input)
	gitSnapshots.set(input.workspaceId, nextSnapshot)
	emitGit()
}

export async function denyGitFileChanges(input: GitReviewFilesInput): Promise<void> {
	const nextSnapshot = await window.api.git.denyFiles(input)
	gitSnapshots.set(input.workspaceId, nextSnapshot)
	emitGit()
}

export async function generateGitCommitMessage(workspaceId: string): Promise<GitCommitMessage> {
	return window.api.git.generateCommitMessage(workspaceId)
}

export async function generateGitDiffTour(workspaceId: string): Promise<GitDiffTour> {
	return window.api.git.generateDiffTour(workspaceId)
}

export async function commitAllGitChanges(input: GitCommitAllInput): Promise<void> {
	const result = await window.api.git.commitAll(input)
	gitSnapshots.set(input.workspaceId, result.status)
	emitGit()
}

export async function pushGitBranch(input: GitPushInput): Promise<void> {
	const result = await window.api.git.push(input)
	gitSnapshots.set(input.workspaceId, result.status)
	emitGit()
}

export async function runGitStackedAction(
	input: GitRunStackedActionInput
): Promise<GitRunStackedActionResult> {
	const result = await window.api.git.runStackedAction(input)
	gitSnapshots.set(input.workspaceId, result.status)
	emitGit()
	return result
}

export function onGitStackedActionProgress(
	listener: (event: GitStackedActionProgressEvent) => void
): () => void {
	return window.api.git.onStackedActionProgress(listener)
}

function retainGitWatch(workspaceId: string): void {
	const watched = watchedGitWorkspaces.get(workspaceId)
	if (watched) {
		watched.refCount += 1
		return
	}

	let focusRefreshTimeout: number | null = null
	const scheduleRefresh = (): void => {
		if (focusRefreshTimeout !== null) window.clearTimeout(focusRefreshTimeout)
		focusRefreshTimeout = window.setTimeout(() => {
			focusRefreshTimeout = null
			void refreshGitStatus(workspaceId).catch(() => undefined)
		}, GIT_STATUS_REFRESH_DEBOUNCE_MS)
	}
	const handleVisibilityChange = (): void => {
		if (document.visibilityState === "visible") scheduleRefresh()
	}
	const intervalId = window.setInterval(() => {
		void refreshGitStatus(workspaceId).catch(() => undefined)
	}, GIT_STATUS_REFRESH_INTERVAL_MS)

	window.addEventListener("focus", scheduleRefresh)
	document.addEventListener("visibilitychange", handleVisibilityChange)
	void refreshGitStatus(workspaceId).catch(() => undefined)

	watchedGitWorkspaces.set(workspaceId, {
		refCount: 1,
		cleanup: () => {
			if (focusRefreshTimeout !== null) window.clearTimeout(focusRefreshTimeout)
			window.clearInterval(intervalId)
			window.removeEventListener("focus", scheduleRefresh)
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	})
}

function releaseGitWatch(workspaceId: string): void {
	const watched = watchedGitWorkspaces.get(workspaceId)
	if (!watched) return

	watched.refCount -= 1
	if (watched.refCount > 0) return

	watched.cleanup()
	watchedGitWorkspaces.delete(workspaceId)
}

function refreshCompletedThreadGitStatus(
	previousSnapshot: AgentSnapshot,
	nextSnapshot: AgentSnapshot
): void {
	const previousThreads = new Map(previousSnapshot.threads.map((thread) => [thread.id, thread]))
	for (const thread of nextSnapshot.threads) {
		const previousThread = previousThreads.get(thread.id)
		const previousSession = previousThread?.session
		const nextSession = thread.session
		if (!previousSession || !nextSession) continue

		const previousRunning =
			previousSession.status === "starting" ||
			previousSession.status === "running" ||
			previousSession.activeTurnId !== null
		const nextSettled =
			nextSession.status === "ready" ||
			nextSession.status === "error" ||
			nextSession.status === "stopped"

		if (previousRunning && nextSettled) {
			for (const [workspaceId, gitSnapshot] of gitSnapshots) {
				if (gitSnapshot.workspacePath === thread.cwd || gitSnapshot.cwd === thread.cwd) {
					void refreshGitStatus(workspaceId).catch(() => undefined)
				}
			}
		}
	}
}
