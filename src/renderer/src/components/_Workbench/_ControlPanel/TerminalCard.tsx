import { useCallback, useRef, type JSX } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

interface TerminalCardProps {
	cwd: string
}

const THEME = {
	background: "#0a0a0a",
	foreground: "#e5e5e5",
	cursor: "#e5e5e5",
	cursorAccent: "#0a0a0a",
	selectionBackground: "#ffffff30",
	black: "#1a1a1a",
	red: "#f87171",
	green: "#4ade80",
	yellow: "#facc15",
	blue: "#60a5fa",
	magenta: "#c084fc",
	cyan: "#22d3ee",
	white: "#e5e5e5",
	brightBlack: "#525252",
	brightRed: "#fca5a5",
	brightGreen: "#86efac",
	brightYellow: "#fde047",
	brightBlue: "#93c5fd",
	brightMagenta: "#d8b4fe",
	brightCyan: "#67e8f9",
	brightWhite: "#fafafa"
}

export default function TerminalCard({ cwd }: TerminalCardProps): JSX.Element {
	const cleanupRef = useRef<(() => void) | null>(null)
	const fitAddonRef = useRef<FitAddon | null>(null)
	const sessionIdRef = useRef<string | null>(null)
	const resizeObserverRef = useRef<ResizeObserver | null>(null)

	const setHostRef = useCallback(
		(node: HTMLDivElement | null) => {
			cleanupRef.current?.()
			cleanupRef.current = null
			if (!node) return

			const term = new Terminal({
				cursorBlink: true,
				fontFamily:
					'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
				fontSize: 12,
				lineHeight: 1.2,
				allowProposedApi: true,
				scrollback: 5000,
				theme: THEME
			})
			const fit = new FitAddon()
			term.loadAddon(fit)
			term.open(node)
			term.attachCustomKeyEventHandler((event) => {
				if (event.type !== "keydown" || event.key !== "Escape") return true
				event.preventDefault()
				event.stopPropagation()
				term.blur()
				if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
				return false
			})

			let mounted = true
			let pendingInput = ""
			let disposeData: (() => void) | null = null
			let disposeExit: (() => void) | null = null

			function safeFit(): { cols: number; rows: number } | null {
				try {
					fit.fit()
					return { cols: term.cols, rows: term.rows }
				} catch {
					return null
				}
			}

			const initialDims = safeFit() ?? { cols: 80, rows: 24 }
			fitAddonRef.current = fit

			void window.api.terminal.session
				.create({ cwd, cols: initialDims.cols, rows: initialDims.rows })
				.then(({ sessionId }) => {
					if (!mounted) {
						window.api.terminal.session.dispose({ sessionId })
						return
					}
					sessionIdRef.current = sessionId
					disposeData = window.api.terminal.session.onData(sessionId, (data) => {
						term.write(data)
					})
					disposeExit = window.api.terminal.session.onExit(sessionId, () => {
						term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n")
					})
					if (pendingInput.length > 0) {
						window.api.terminal.session.write({ sessionId, data: pendingInput })
						pendingInput = ""
					}
					const dims = safeFit()
					if (dims) window.api.terminal.session.resize({ sessionId, ...dims })
				})
				.catch((cause: unknown) => {
					term.write(
						`\r\n\x1b[31mFailed to start terminal: ${cause instanceof Error ? cause.message : String(cause)}\x1b[0m\r\n`
					)
				})

			const dataDisposable = term.onData((data) => {
				const sessionId = sessionIdRef.current
				if (sessionId) {
					window.api.terminal.session.write({ sessionId, data })
				} else {
					pendingInput += data
				}
			})

			const observer = new ResizeObserver(() => {
				const dims = safeFit()
				const sessionId = sessionIdRef.current
				if (dims && sessionId) {
					window.api.terminal.session.resize({ sessionId, ...dims })
				}
			})
			observer.observe(node)
			resizeObserverRef.current = observer

			term.focus()

			cleanupRef.current = () => {
				mounted = false
				observer.disconnect()
				resizeObserverRef.current = null
				dataDisposable.dispose()
				disposeData?.()
				disposeExit?.()
				const sessionId = sessionIdRef.current
				if (sessionId) {
					window.api.terminal.session.dispose({ sessionId })
					sessionIdRef.current = null
				}
				term.dispose()
				fitAddonRef.current = null
			}
		},
		[cwd]
	)

	return (
		<div className="flex h-full min-h-0 flex-col bg-neutral-950">
			<div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
				<span className="truncate font-mono text-[11px] text-blue-200">{cwd}</span>
			</div>
			<div ref={setHostRef} className="nowheel min-h-0 flex-1 overflow-hidden bg-[#0a0a0a] p-2" />
		</div>
	)
}
