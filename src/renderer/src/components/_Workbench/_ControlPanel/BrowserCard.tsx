import { useCallback, useRef, useState, type FormEvent, type JSX } from "react"
import { ArrowLeft, ArrowRight, Play, RotateCw } from "lucide-react"

interface BrowserWebview extends HTMLElement {
	canGoBack: () => boolean
	canGoForward: () => boolean
	getURL: () => string
	goBack: () => void
	goForward: () => void
	reload: () => void
}

interface DidFailLoadEvent extends Event {
	errorCode: number
	errorDescription: string
	validatedURL: string
}

interface BrowserCardProps {
	enterDevAction: string
	projectName: string
	workspacePath: string
}

function normalizeUrl(value: string): string {
	const input = value.trim()
	if (!input) return "about:blank"
	if (input.startsWith("about:")) return input
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)) return input
	return `https://${input}`
}

function devServerUrl(projectName: string, workspacePath: string): string {
	const hash = stableHash(workspacePath)
	const slug =
		projectName
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/(^-|-$)/g, "")
			.slice(0, 32) || "project"
	return `https://beaver-${slug}-${hash}.localhost:1355`
}

function stableHash(value: string): string {
	let hash = 0x811c9dc5
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 0x01000193)
	}
	return (hash >>> 0).toString(16).padStart(8, "0")
}

export default function BrowserCard({
	enterDevAction,
	projectName,
	workspacePath
}: BrowserCardProps): JSX.Element {
	const webviewRef = useRef<BrowserWebview | null>(null)
	const listenerCleanupRef = useRef<(() => void) | null>(null)
	const initialUrl = devServerUrl(projectName, workspacePath)
	const [draftUrl, setDraftUrl] = useState(initialUrl)
	const [activeUrl, setActiveUrl] = useState(initialUrl)
	const [error, setError] = useState<string | null>(null)
	const [launching, setLaunching] = useState(false)

	const setWebviewRef = useCallback((node: HTMLElement | null) => {
		listenerCleanupRef.current?.()
		listenerCleanupRef.current = null
		const webview = node as BrowserWebview | null
		webviewRef.current = webview
		if (!webview) return

		const handleNavigate = (): void => {
			const current = webview.getURL()
			setActiveUrl(current)
			setDraftUrl(current)
			setError(null)
		}
		const handleFailLoad = (event: Event): void => {
			const detail = event as DidFailLoadEvent
			if (detail.errorCode === -3) return
			setError(
				detail.errorDescription
					? `${detail.errorDescription}${detail.validatedURL ? ` (${detail.validatedURL})` : ""}`
					: "Failed to load page."
			)
		}

		webview.addEventListener("did-navigate", handleNavigate)
		webview.addEventListener("did-navigate-in-page", handleNavigate)
		webview.addEventListener("did-fail-load", handleFailLoad)
		listenerCleanupRef.current = () => {
			webview.removeEventListener("did-navigate", handleNavigate)
			webview.removeEventListener("did-navigate-in-page", handleNavigate)
			webview.removeEventListener("did-fail-load", handleFailLoad)
		}
	}, [])

	function navigate(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const next = normalizeUrl(draftUrl)
		setDraftUrl(next)
		setActiveUrl(next)
		setError(null)
	}

	async function openDevServer(): Promise<void> {
		setLaunching(true)
		setError(null)
		try {
			const result = await window.api.devServer.launchProject({
				cwd: workspacePath,
				name: projectName,
				enterDevAction,
				openExternal: false
			})
			setDraftUrl(result.url)
			setActiveUrl(result.url)
		} catch (launchError) {
			setError(launchError instanceof Error ? launchError.message : "Failed to open dev server.")
		} finally {
			setLaunching(false)
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-neutral-950">
			<div className="flex items-center gap-2 border-b border-white/8 p-2">
				<button
					type="button"
					onClick={() => {
						if (webviewRef.current?.canGoBack()) webviewRef.current.goBack()
					}}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200"
				>
					<ArrowLeft size={12} />
				</button>
				<button
					type="button"
					onClick={() => {
						if (webviewRef.current?.canGoForward()) webviewRef.current.goForward()
					}}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200"
				>
					<ArrowRight size={12} />
				</button>
				<button
					type="button"
					onClick={() => {
						setError(null)
						webviewRef.current?.reload()
					}}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200"
				>
					<RotateCw size={12} />
				</button>
				<button
					type="button"
					onClick={() => void openDevServer()}
					disabled={launching}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200 disabled:cursor-wait disabled:opacity-60"
					aria-label="Open dev server"
					title="Open dev server"
				>
					<Play size={12} />
				</button>

				<form onSubmit={navigate} className="flex min-w-0 flex-1 items-center gap-2">
					<input
						value={draftUrl}
						onChange={(event) => setDraftUrl(event.currentTarget.value)}
						placeholder="Enter URL"
						className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
					/>
					<button
						type="submit"
						className="h-8 rounded-md bg-white/90 px-3 text-xs font-medium text-neutral-900 transition-colors hover:bg-white"
					>
						Go
					</button>
				</form>
			</div>

			{error ? (
				<div className="border-b border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] text-red-300">
					{error}
				</div>
			) : null}

			<div className="min-h-0 flex-1">
				<webview ref={setWebviewRef} src={activeUrl} className="h-full w-full" />
			</div>
		</div>
	)
}
