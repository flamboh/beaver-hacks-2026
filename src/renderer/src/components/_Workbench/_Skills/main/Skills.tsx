import {
	findProjectSkills,
	installProjectSkill,
	uninstallProjectSkill,
	useAgentSnapshot
} from "@renderer/agentStore"
import { ExternalLink, Trash2 } from "lucide-react"
import type { AgentSkillSuggestion } from "src/main/agent/contracts"
import { type FormEvent, useMemo, useState, useSyncExternalStore } from "react"

interface Props {
	projectPath: string
}

interface InstalledSkill {
	id: string
	name: string
	path: string
	description: string | null
}

const EMPTY_INSTALLED_SKILLS: InstalledSkill[] = []
const installedSkillListeners = new Set<() => void>()
const installedSkillSnapshots = new Map<string, InstalledSkill[]>()
const installedSkillRefreshes = new Map<string, Promise<InstalledSkill[]>>()

function emitInstalledSkills(): void {
	for (const listener of installedSkillListeners) listener()
}

function compactSkillPath(skillPath: string): string {
	const parts = skillPath.split(/[\\/]+/).filter(Boolean)
	return parts.slice(-3).join("/")
}

function getInstalledSkillsSnapshot(projectPath: string): InstalledSkill[] {
	return installedSkillSnapshots.get(projectPath) ?? EMPTY_INSTALLED_SKILLS
}

function subscribeInstalledSkills(projectPath: string, listener: () => void): () => void {
	installedSkillListeners.add(listener)
	if (projectPath && !installedSkillSnapshots.has(projectPath)) {
		void refreshInstalledSkills(projectPath)
	}

	return () => {
		installedSkillListeners.delete(listener)
	}
}

function useInstalledSkills(projectPath: string): InstalledSkill[] {
	const subscribe = useMemo(
		() => (listener: () => void) => subscribeInstalledSkills(projectPath, listener),
		[projectPath]
	)
	const read = useMemo(() => () => getInstalledSkillsSnapshot(projectPath), [projectPath])
	return useSyncExternalStore(subscribe, read, read)
}

async function refreshInstalledSkills(projectPath: string): Promise<InstalledSkill[]> {
	const inFlight = installedSkillRefreshes.get(projectPath)
	if (inFlight) return inFlight

	const refresh = Promise.resolve()
		.then(() => window.api.composer.listMentions(projectPath))
		.then((mentions) =>
			mentions
				.filter((mention) => mention.kind === "skill")
				.map((skill) => ({
					id: skill.path,
					name: skill.name,
					path: skill.path,
					description: skill.description
				}))
		)
		.catch(() => EMPTY_INSTALLED_SKILLS)
		.then((skills) => {
			installedSkillSnapshots.set(projectPath, skills)
			emitInstalledSkills()
			return skills
		})
		.finally(() => installedSkillRefreshes.delete(projectPath))
	installedSkillRefreshes.set(projectPath, refresh)
	return refresh
}

export default function Skills({ projectPath }: Props) {
	const [isScanning, setIsScanning] = useState(false)
	const [installingSkillId, setInstallingSkillId] = useState<string | null>(null)
	const [uninstallingSkillPath, setUninstallingSkillPath] = useState<string | null>(null)
	const [installSkill, setInstallSkill] = useState<AgentSkillSuggestion | null>(null)
	const [installError, setInstallError] = useState<string | null>(null)
	const snapshot = useAgentSnapshot()
	const threadId = `skills:${projectPath}`
	const thread = snapshot.threads.find((thread) => thread.id === threadId) ?? null
	const allSuggestions = thread?.suggestedSkills ?? []
	const suggestions = allSuggestions.filter((skill) => !skill.installed)
	const installedSkills = useInstalledSkills(projectPath)
	const latestSkillActivity = [...(thread?.activities ?? [])]
		.reverse()
		.find((activity) => activity.kind.startsWith("skills."))

	async function scanSkills(): Promise<void> {
		setIsScanning(true)
		try {
			await findProjectSkills({
				threadId,
				cwd: projectPath,
				prompt: "Find relevant skills for this project."
			})
		} finally {
			setIsScanning(false)
		}
	}

	async function confirmInstallSkill(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault()
		if (!installSkill) return

		setInstallError(null)
		setInstallingSkillId(installSkill.id)
		try {
			await installProjectSkill({ threadId, skillId: installSkill.id })
			void refreshInstalledSkills(projectPath)
			setInstallSkill(null)
		} catch (error) {
			setInstallError(error instanceof Error ? error.message : String(error))
		} finally {
			setInstallingSkillId(null)
		}
	}

	async function uninstallSkill(skill: InstalledSkill): Promise<void> {
		setUninstallingSkillPath(skill.path)
		try {
			await uninstallProjectSkill({ threadId, cwd: projectPath, skillPath: skill.path })
			void refreshInstalledSkills(projectPath)
		} finally {
			setUninstallingSkillPath(null)
		}
	}

	return (
		<section className="h-full overflow-auto">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<h1 className="text-sm font-medium text-white">Skills</h1>
						<p className="mt-1 truncate font-mono text-xs text-neutral-500">{projectPath}</p>
					</div>
					<button
						type="button"
						onClick={() => void scanSkills()}
						disabled={isScanning}
						className="min-w-24 cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isScanning ? "Scanning..." : "Find Skills"}
					</button>
				</div>

				{latestSkillActivity ? (
					<div className="rounded-md border border-white/8 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
						{latestSkillActivity.summary}
					</div>
				) : null}

				<div className="grid min-h-0 items-start gap-5 lg:grid-cols-2">
					<SkillTable
						title="Suggested Skills"
						emptyText="No skills scanned yet."
						skills={suggestions}
						installingSkillId={installingSkillId}
						onInstall={(skill) => {
							setInstallError(null)
							setInstallSkill(skill)
						}}
					/>
					<InstalledSkillTable
						title="Installed Skills"
						emptyText="No installed skills yet."
						skills={installedSkills}
						uninstallingSkillPath={uninstallingSkillPath}
						onUninstall={(skill) => void uninstallSkill(skill)}
					/>
				</div>
			</div>
			{installSkill ? (
				<InstallSkillModal
					skill={installSkill}
					error={installError}
					isInstalling={installingSkillId === installSkill.id}
					onCancel={() => {
						if (installingSkillId) return
						setInstallSkill(null)
						setInstallError(null)
					}}
					onSubmit={confirmInstallSkill}
				/>
			) : null}
		</section>
	)
}

function SkillTable({
	title,
	emptyText,
	skills,
	installingSkillId,
	onInstall
}: {
	title: string
	emptyText: string
	skills: AgentSkillSuggestion[]
	installingSkillId: string | null
	onInstall: (skill: AgentSkillSuggestion) => void
}) {
	return (
		<div className="min-h-[764px] overflow-hidden rounded-lg border border-white/8 bg-neutral-900">
			<div className="border-b border-white/5 px-4 py-3 text-xs font-medium text-neutral-300">
				{title}
			</div>
			{skills.length > 0 ? (
				<ul className="divide-y divide-white/5">
					{skills.map((skill) => (
						<SkillRow
							key={skill.id}
							skill={skill}
							isInstalling={installingSkillId === skill.id}
							onInstall={() => onInstall(skill)}
						/>
					))}
				</ul>
			) : (
				<div className="px-4 py-10 text-center text-xs text-neutral-500">{emptyText}</div>
			)}
		</div>
	)
}

function InstalledSkillTable({
	title,
	emptyText,
	skills,
	uninstallingSkillPath,
	onUninstall
}: {
	title: string
	emptyText: string
	skills: InstalledSkill[]
	uninstallingSkillPath: string | null
	onUninstall: (skill: InstalledSkill) => void
}) {
	return (
		<div className="min-h-[764px] overflow-hidden rounded-lg border border-white/8 bg-neutral-900">
			<div className="border-b border-white/5 px-4 py-3 text-xs font-medium text-neutral-300">
				{title}
			</div>
			{skills.length > 0 ? (
				<ul className="divide-y divide-white/5">
					{skills.map((skill) => (
						<InstalledSkillRow
							key={skill.id}
							skill={skill}
							isUninstalling={uninstallingSkillPath === skill.path}
							onUninstall={() => onUninstall(skill)}
						/>
					))}
				</ul>
			) : (
				<div className="px-4 py-10 text-center text-xs text-neutral-500">{emptyText}</div>
			)}
		</div>
	)
}

function SkillRow({
	skill,
	isInstalling,
	onInstall
}: {
	skill: AgentSkillSuggestion
	isInstalling: boolean
	onInstall: () => void
}) {
	const skillUrl = skill.url || `https://github.com/${skill.source}`
	const canInstall = Boolean(skill.installUrl) && !skill.installed
	const author = skill.source.split("/")[0]

	return (
		<li className="group flex min-h-[72px] items-center gap-4 px-4 py-2.5">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-sm font-medium text-neutral-100">{skill.slug}</h2>
					<span className="shrink-0 rounded border border-white/8 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neutral-500">
						{skill.sourceType}
					</span>
					{skill.installed ? (
						<span className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
							Installed
						</span>
					) : null}
				</div>
				<p className="mt-1 line-clamp-1 text-xs leading-5 text-neutral-400">{skill.description}</p>
				<div className="mt-1.5 flex min-w-0 items-center gap-3 text-xs text-neutral-500">
					<span className="truncate">{author}</span>
					<span className="shrink-0 text-neutral-600">•</span>
					<span>{skill.installs.toLocaleString()} installs</span>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1 self-center">
				<button
					type="button"
					onClick={onInstall}
					disabled={!canInstall || isInstalling}
					className="cursor-pointer rounded-md border border-white/8 px-2.5 py-1.5 text-xs font-medium text-neutral-300 opacity-0 transition-colors duration-150 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100"
				>
					{skill.installed ? "Installed" : isInstalling ? "Installing..." : "Install"}
				</button>
				<a
					href={skillUrl}
					target="_blank"
					rel="noreferrer"
					className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-colors duration-150 hover:bg-white/5 hover:text-neutral-200 group-hover:opacity-100"
					title="Open skill"
				>
					<ExternalLink size={14} />
				</a>
			</div>
		</li>
	)
}

function InstalledSkillRow({
	skill,
	isUninstalling,
	onUninstall
}: {
	skill: InstalledSkill
	isUninstalling: boolean
	onUninstall: () => void
}) {
	return (
		<li className="group flex min-h-[72px] items-center gap-4 px-4 py-2.5">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-sm font-medium text-neutral-100">{skill.name}</h2>
					<span className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
						Installed
					</span>
				</div>
				<p className="mt-1.5 truncate font-mono text-xs text-neutral-500" title={skill.path}>
					{compactSkillPath(skill.path)}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-1 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
				<button
					type="button"
					onClick={onUninstall}
					disabled={isUninstalling}
					className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors duration-150 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Trash2 size={12} />
					{isUninstalling ? "Uninstalling..." : "Uninstall"}
				</button>
			</div>
		</li>
	)
}

function InstallSkillModal({
	skill,
	error,
	isInstalling,
	onCancel,
	onSubmit
}: {
	skill: AgentSkillSuggestion
	error: string | null
	isInstalling: boolean
	onCancel: () => void
	onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
	const command = `npx skills add ${skill.installUrl ?? skill.id} -y`

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 text-white">
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="install-skill-title"
				onSubmit={onSubmit}
				className="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl"
			>
				<header className="border-b border-white/5 px-4 py-3">
					<h2 id="install-skill-title" className="text-sm font-medium text-white">
						Install Skill
					</h2>
				</header>
				<div className="flex flex-col gap-4 px-4 py-5">
					<p className="text-sm leading-6 text-neutral-300">
						Do you wish to install <span className="font-medium text-white">{skill.slug}</span>{" "}
						skill?
					</p>
					<input
						readOnly
						value={command}
						className="w-full rounded-md border border-white/8 bg-neutral-800/60 px-3 py-2 font-mono text-xs text-neutral-300 focus:outline-none"
					/>
					{error ? (
						<p className="rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
							{error}
						</p>
					) : null}
				</div>
				<footer className="flex items-center justify-end gap-2 border-t border-white/5 px-4 py-3">
					<button
						type="button"
						onClick={onCancel}
						disabled={isInstalling}
						className="cursor-pointer rounded-md border border-white/8 px-3 py-1.5 text-sm text-neutral-400 transition-colors duration-150 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isInstalling}
						className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isInstalling ? "Installing..." : "Install"}
					</button>
				</footer>
			</form>
		</div>
	)
}
