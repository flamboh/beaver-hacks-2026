import { useQuery } from "@tanstack/react-query"
import { FolderOpen, FolderPlus, Save } from "lucide-react"
import { useState } from "react"

const WORKSPACE_TEMPLATE_KEY = "workspace.default_template"
const DEFAULT_WORKSPACE_TEMPLATE = "~/.nulloth/worktrees/{projectSlug}/{workspaceSlug}"

interface SettingsProps {
	onWorkspacesChanged: () => void
	projectId: string
}

export default function Settings({ onWorkspacesChanged, projectId }: SettingsProps) {
	const [templateDraft, setTemplateDraft] = useState("")
	const [existingName, setExistingName] = useState("")
	const [existingPath, setExistingPath] = useState("")
	const [message, setMessage] = useState<string | null>(null)
	const [busy, setBusy] = useState<"setting" | "workspace" | null>(null)
	const templateQuery = useQuery({
		queryKey: ["setting", WORKSPACE_TEMPLATE_KEY],
		queryFn: () => window.api.settings.get(WORKSPACE_TEMPLATE_KEY)
	})
	const template = templateDraft || templateQuery.data || DEFAULT_WORKSPACE_TEMPLATE

	function nameFromPath(path: string): string {
		return path.split(/[\\/]/g).filter(Boolean).at(-1) ?? ""
	}

	function saveTemplate(): void {
		setBusy("setting")
		setMessage(null)
		void window.api.settings
			.update({ key: WORKSPACE_TEMPLATE_KEY, value: template })
			.then(() => {
				setTemplateDraft("")
				setMessage("Workspace template saved.")
				return templateQuery.refetch()
			})
			.catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)))
			.finally(() => setBusy(null))
	}

	function browseExistingWorkspace(): void {
		void window.api.dialog.selectDirectory().then((selectedPath) => {
			if (!selectedPath) return
			setExistingPath(selectedPath)
			if (!existingName.trim()) setExistingName(nameFromPath(selectedPath))
			setMessage(null)
		})
	}

	function addExistingWorkspace(): void {
		const path = existingPath.trim()
		const name = existingName.trim() || nameFromPath(path)
		if (!name || !path) return
		setBusy("workspace")
		setMessage(null)
		void window.api.workspaces
			.create({ projectId, name, path })
			.then((workspace) => window.api.workspaces.activate({ id: workspace.id }))
			.then(() => {
				setExistingName("")
				setExistingPath("")
				setMessage("Workspace added.")
				onWorkspacesChanged()
			})
			.catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)))
			.finally(() => setBusy(null))
	}

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-6">
			<section className="border-b border-white/10 pb-6">
				<h1 className="text-base font-semibold text-white">Settings</h1>
				<p className="mt-1 text-xs text-neutral-500">Workspace defaults.</p>
			</section>

			<section className="flex flex-col gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-4">
				<label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
					Workspace folder template
				</label>
				<div className="flex gap-2">
					<input
						value={template}
						onChange={(event) => setTemplateDraft(event.currentTarget.value)}
						className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-950 px-3 font-mono text-sm text-neutral-200 outline-none focus:border-white/20"
					/>
					<button
						type="button"
						onClick={saveTemplate}
						disabled={busy !== null || !template.trim()}
						className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save size={14} />
						Save
					</button>
				</div>
				<p className="text-xs text-neutral-500">
					Default: ~/.nulloth/worktrees/{"{projectSlug}"}/{"{workspaceSlug}"}
				</p>
			</section>

			<section className="flex flex-col gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-4">
				<label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
					Existing workspace
				</label>
				<div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
					<input
						value={existingName}
						onChange={(event) => setExistingName(event.currentTarget.value)}
						placeholder="workspace name"
						className="h-9 min-w-0 rounded-md border border-white/10 bg-neutral-950 px-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/20"
					/>
					<input
						value={existingPath}
						onChange={(event) => setExistingPath(event.currentTarget.value)}
						placeholder="/path/to/worktree"
						className="h-9 min-w-0 rounded-md border border-white/10 bg-neutral-950 px-3 font-mono text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/20"
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={browseExistingWorkspace}
						disabled={busy !== null}
						className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-neutral-300 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-neutral-600"
					>
						<FolderOpen size={14} />
						Browse
					</button>
					<button
						type="button"
						onClick={addExistingWorkspace}
						disabled={busy !== null || !existingPath.trim()}
						className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm font-medium text-neutral-200 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:text-neutral-600"
					>
						<FolderPlus size={14} />
						Add
					</button>
				</div>
			</section>

			{message ? <p className="text-xs text-neutral-400">{message}</p> : null}
		</div>
	)
}
