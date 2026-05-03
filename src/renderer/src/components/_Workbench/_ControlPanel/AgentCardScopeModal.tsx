import { type FormEvent, useState } from "react"
import { parseScopePath } from "./agentCardScopePath"

type ScopeModalProps = {
	agentName: string
	initialScopePath: string
	onCancel: () => void
	onSave: (scopePath: string) => Promise<void>
	projectPath: string
}

export default function AgentCardScopeModal({
	agentName,
	initialScopePath,
	onCancel,
	onSave,
	projectPath
}: ScopeModalProps) {
	const [mode, setMode] = useState<"describe" | "path">("path")
	const [description, setDescription] = useState("")
	const [path, setPath] = useState(initialScopePath)
	const [saving, setSaving] = useState(false)

	const fallbackFileName =
		parseScopePath(path) || `${agentName.trim().replace(/[^A-Za-z0-9._-]+/g, "-") || "agent"}-scope`

	const handleBrowse = async () => {
		const selectedPath = await window.api.dialog.selectFile()
		if (selectedPath) setPath(selectedPath)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setSaving(true)
		const nextScopePath =
			mode === "describe"
				? (
						await window.api.files.saveScopeFile({
							projectPath,
							fileName: fallbackFileName,
							contents: description
						})
					).relativePath
				: path
		await onSave(nextScopePath)
		setSaving(false)
		onCancel()
	}

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md rounded-lg border border-white/10 bg-neutral-900 shadow-2xl"
			>
				<div className="flex h-12 items-center justify-between border-b border-white/5 px-4">
					<h2 className="text-sm font-medium text-white">Edit Scope</h2>
				</div>
				<div className="flex flex-col gap-4 p-4">
					<div className="grid grid-cols-2 overflow-hidden rounded-md border border-white/5 text-xs">
						<button
							type="button"
							onClick={() => setMode("describe")}
							className={`cursor-pointer py-2 transition-colors ${
								mode === "describe"
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:text-neutral-300"
							}`}
						>
							Describe
						</button>
						<button
							type="button"
							onClick={() => setMode("path")}
							className={`cursor-pointer py-2 transition-colors ${
								mode === "path"
									? "bg-white/8 text-white"
									: "text-neutral-500 hover:text-neutral-300"
							}`}
						>
							File Path
						</button>
					</div>

					{mode === "describe" ? (
						<textarea
							value={description}
							onChange={(event) => setDescription(event.currentTarget.value)}
							rows={5}
							placeholder="Describe what this agent should accomplish..."
							className="resize-none rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
						/>
					) : null}

					<div className="flex gap-2">
						<input
							type="text"
							value={path}
							onChange={(event) => setPath(event.currentTarget.value)}
							placeholder="./scopes/test-coverage.md"
							className="min-w-0 flex-1 rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 font-mono text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
						/>
						<button
							type="button"
							onClick={handleBrowse}
							className="cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/15"
						>
							Browse
						</button>
					</div>
				</div>
				<div className="flex justify-end gap-2 border-t border-white/5 p-4">
					<button
						type="button"
						onClick={onCancel}
						disabled={saving}
						className="cursor-pointer rounded-md border border-white/8 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving}
						className="cursor-pointer rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</form>
		</div>
	)
}
