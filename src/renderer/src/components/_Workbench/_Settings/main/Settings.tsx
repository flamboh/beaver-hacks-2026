import { useQuery } from "@tanstack/react-query"
import { FolderPlus, Save } from "lucide-react"
import { useState } from "react"

const WORKSPACE_TEMPLATE_KEY = "workspace.default_template"

interface SettingsProps {
	onWorkspacesChanged: () => void
	projectId: string
}

export default function Settings({ onWorkspacesChanged, projectId }: SettingsProps) {
	const [templateDraft, setTemplateDraft] = useState("")
	const [workspaceName, setWorkspaceName] = useState("")
	const [message, setMessage] = useState<string | null>(null)
	const [busy, setBusy] = useState<"setting" | "workspace" | null>(null)
	const templateQuery = useQuery({
		queryKey: ["setting", WORKSPACE_TEMPLATE_KEY],
		queryFn: () => window.api.settings.get(WORKSPACE_TEMPLATE_KEY)
	})
	const template =
		templateDraft || templateQuery.data || "../nulloth-workspaces/{projectSlug}/{workspaceSlug}"

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

	function createWorkspace(): void {
		const name = workspaceName.trim()
		if (!name) return
		setBusy("workspace")
		setMessage(null)
		void window.api.workspaces
			.create({ projectId, name })
			.then((workspace) => window.api.workspaces.activate({ id: workspace.id }))
			.then(() => {
				setWorkspaceName("")
				setMessage("Workspace created.")
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
					Default: ../nulloth-workspaces/{"{projectSlug}"}/{"{workspaceSlug}"}
				</p>
			</section>

			<section className="flex flex-col gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-4">
				<label className="text-xs font-medium uppercase tracking-widest text-neutral-500">
					New workspace
				</label>
				<div className="flex gap-2">
					<input
						value={workspaceName}
						onChange={(event) => setWorkspaceName(event.currentTarget.value)}
						placeholder="feature-auth"
						className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-950 px-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-white/20"
					/>
					<button
						type="button"
						onClick={createWorkspace}
						disabled={busy !== null || !workspaceName.trim()}
						className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm font-medium text-neutral-200 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:text-neutral-600"
					>
						<FolderPlus size={14} />
						Create
					</button>
				</div>
			</section>

			{message ? <p className="text-xs text-neutral-400">{message}</p> : null}
		</div>
	)
}
