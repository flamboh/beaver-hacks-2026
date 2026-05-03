import type { FormEvent, JSX } from "react"
import { useState } from "react"
import { LoaderCircle, Trash2 } from "lucide-react"

interface TerminalCardProps {
	cwd: string
}

interface TerminalEntry {
	id: number
	command: string
	stdout: string
	stderr: string
	exitCode: number | null
}

export default function TerminalCard({ cwd }: TerminalCardProps): JSX.Element {
	const [command, setCommand] = useState("")
	const [entries, setEntries] = useState<TerminalEntry[]>([])
	const [nextId, setNextId] = useState(1)
	const [isRunning, setIsRunning] = useState(false)

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault()
		const trimmed = command.trim()
		if (!trimmed || isRunning) return
		setCommand("")
		setIsRunning(true)
		const id = nextId
		setNextId((value) => value + 1)

		void window.api.terminal
			.run({ cwd, command: trimmed })
			.then((result) => {
				setEntries((prev) => [
					...prev,
					{
						id,
						command: trimmed,
						stdout: result.stdout,
						stderr: result.stderr,
						exitCode: result.exitCode
					}
				])
			})
			.catch((cause: unknown) => {
				setEntries((prev) => [
					...prev,
					{
						id,
						command: trimmed,
						stdout: "",
						stderr: cause instanceof Error ? cause.message : String(cause),
						exitCode: 1
					}
				])
			})
			.finally(() => setIsRunning(false))
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-neutral-950">
			<div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
				<span className="truncate font-mono text-[11px] text-neutral-500">{cwd}</span>
				<button
					type="button"
					onClick={() => setEntries([])}
					className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:border-white/20 hover:text-neutral-200"
				>
					<Trash2 size={11} />
					Clear
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs text-neutral-200">
				{entries.length === 0 ? (
					<p className="text-neutral-600">
						Run commands against your local OS shell from this workspace.
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{entries.map((entry) => (
							<div key={entry.id} className="space-y-1">
								<p className="text-neutral-400">
									<span className="text-neutral-600">$</span> {entry.command}
								</p>
								{entry.stdout ? (
									<pre className="whitespace-pre-wrap break-words text-neutral-200">
										{entry.stdout}
									</pre>
								) : null}
								{entry.stderr ? (
									<pre className="whitespace-pre-wrap break-words text-red-400">{entry.stderr}</pre>
								) : null}
								<p className="text-[11px] text-neutral-600">exit: {entry.exitCode ?? "null"}</p>
							</div>
						))}
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/8 p-3">
				<span className="font-mono text-xs text-neutral-600">$</span>
				<input
					value={command}
					onChange={(event) => setCommand(event.currentTarget.value)}
					placeholder="Enter command"
					className="h-9 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 font-mono text-xs text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
				/>
				<button
					type="submit"
					disabled={!command.trim() || isRunning}
					className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-white/90 px-3 text-xs font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isRunning ? <LoaderCircle size={12} className="animate-spin" /> : null}
					Run
				</button>
			</form>
		</div>
	)
}
