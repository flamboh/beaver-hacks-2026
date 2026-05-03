import { ExternalLink, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import type { FormEvent } from "react"
import type { AgentSkillSuggestion } from "src/main/agent/contracts"
import type { InstalledSkill } from "./installedSkillsStore"

export function SkillTable({
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
					{skills.map((skill, index) => (
						<SkillRow
							key={skill.id}
							skill={skill}
							index={index}
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

export function InstalledSkillTable({
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

export function InstallSkillModal({
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

function SkillRow({
	skill,
	index,
	isInstalling,
	onInstall
}: {
	skill: AgentSkillSuggestion
	index: number
	isInstalling: boolean
	onInstall: () => void
}) {
	const skillUrl = skill.url || `https://github.com/${skill.source}`
	const canInstall = Boolean(skill.installUrl) && !skill.installed
	const author = skill.source.split("/")[0]

	return (
		<motion.li
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: "spring", duration: 0.3, bounce: 0, delay: index * 0.025 }}
			className="group flex min-h-[72px] items-center gap-4 px-4 py-2.5"
		>
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
					className="polished-button cursor-pointer rounded-md border border-white/8 px-2.5 py-1.5 text-xs font-medium text-neutral-300 opacity-0 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100"
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
		</motion.li>
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

function compactSkillPath(skillPath: string): string {
	const parts = skillPath.split(/[\\/]+/).filter(Boolean)
	return parts.slice(-3).join("/")
}
