import { useMemo, useSyncExternalStore } from "react"
import type { AgentSnapshot } from "../../main/agent/ipc"
import type {
	GitCheckoutInput,
	GitCommitAllInput,
	GitCommitMessage,
	GitCreateBranchInput,
	GitPushInput,
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
const watchedGitCwds = new Map<string, { refCount: number; cleanup: () => void }>()
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

export async function sendAgentMessage(input: {
	prompt: string
	cwd: string
	threadId?: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.startTurn({
		...(input.threadId ? { threadId: input.threadId } : {}),
		cwd: input.cwd,
		prompt: input.prompt,
		runtimeMode: "full-access"
	})
	setSnapshot(nextSnapshot)
}

export async function findProjectSkills(input: {
	threadId?: string
	prompt?: string
}): Promise<void> {
	const nextSnapshot = await window.api.agent.findSkills({
		...(input.threadId ? { threadId: input.threadId } : {}),
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

function subscribeGit(cwd: string, listener: () => void): () => void {
	gitListeners.add(listener)
	if (cwd) retainGitWatch(cwd)

	return () => {
		gitListeners.delete(listener)
		if (cwd) releaseGitWatch(cwd)
	}
}

function getGitSnapshot(cwd: string): GitStatusSnapshot | null {
	return gitSnapshots.get(cwd) ?? null
}

export function useGitStatus(cwd: string): GitStatusSnapshot | null {
	const subscribe = useMemo(() => (listener: () => void) => subscribeGit(cwd, listener), [cwd])
	const read = useMemo(() => () => getGitSnapshot(cwd), [cwd])
	return useSyncExternalStore(subscribe, read, read)
}

export async function refreshGitStatus(cwd: string): Promise<GitStatusSnapshot> {
	const inFlight = gitRefreshInFlight.get(cwd)
	if (inFlight) return inFlight

	const lastRefreshAt = gitLastRefreshAt.get(cwd) ?? 0
	if (Date.now() - lastRefreshAt < GIT_STATUS_REFRESH_DEBOUNCE_MS) {
		const cached = gitSnapshots.get(cwd)
		if (cached) return cached
	}

	gitLastRefreshAt.set(cwd, Date.now())
	const refresh = window.api.git
		.getStatus(cwd)
		.then((nextSnapshot) => {
			gitSnapshots.set(cwd, nextSnapshot)
			emitGit()
			return nextSnapshot
		})
		.finally(() => gitRefreshInFlight.delete(cwd))
	gitRefreshInFlight.set(cwd, refresh)
	return refresh
}

export async function checkoutGitBranch(input: GitCheckoutInput): Promise<void> {
	const nextSnapshot = await window.api.git.checkout(input)
	gitSnapshots.set(input.cwd, nextSnapshot)
	emitGit()
}

export async function createGitBranch(input: GitCreateBranchInput): Promise<void> {
	const nextSnapshot = await window.api.git.createBranch(input)
	gitSnapshots.set(input.cwd, nextSnapshot)
	emitGit()
}

export async function generateGitCommitMessage(cwd: string): Promise<GitCommitMessage> {
	return window.api.git.generateCommitMessage(cwd)
}

export async function commitAllGitChanges(input: GitCommitAllInput): Promise<void> {
	const result = await window.api.git.commitAll(input)
	gitSnapshots.set(input.cwd, result.status)
	emitGit()
}

export async function pushGitBranch(input: GitPushInput): Promise<void> {
	const result = await window.api.git.push(input)
	gitSnapshots.set(input.cwd, result.status)
	emitGit()
}

function retainGitWatch(cwd: string): void {
	const watched = watchedGitCwds.get(cwd)
	if (watched) {
		watched.refCount += 1
		return
	}

	let focusRefreshTimeout: number | null = null
	const scheduleRefresh = (): void => {
		if (focusRefreshTimeout !== null) window.clearTimeout(focusRefreshTimeout)
		focusRefreshTimeout = window.setTimeout(() => {
			focusRefreshTimeout = null
			void refreshGitStatus(cwd).catch(() => undefined)
		}, GIT_STATUS_REFRESH_DEBOUNCE_MS)
	}
	const handleVisibilityChange = (): void => {
		if (document.visibilityState === "visible") scheduleRefresh()
	}
	const intervalId = window.setInterval(() => {
		void refreshGitStatus(cwd).catch(() => undefined)
	}, GIT_STATUS_REFRESH_INTERVAL_MS)

	window.addEventListener("focus", scheduleRefresh)
	document.addEventListener("visibilitychange", handleVisibilityChange)
	void refreshGitStatus(cwd).catch(() => undefined)

	watchedGitCwds.set(cwd, {
		refCount: 1,
		cleanup: () => {
			if (focusRefreshTimeout !== null) window.clearTimeout(focusRefreshTimeout)
			window.clearInterval(intervalId)
			window.removeEventListener("focus", scheduleRefresh)
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	})
}

function releaseGitWatch(cwd: string): void {
	const watched = watchedGitCwds.get(cwd)
	if (!watched) return

	watched.refCount -= 1
	if (watched.refCount > 0) return

	watched.cleanup()
	watchedGitCwds.delete(cwd)
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
			void refreshGitStatus(thread.cwd).catch(() => undefined)
		}
	}
}
