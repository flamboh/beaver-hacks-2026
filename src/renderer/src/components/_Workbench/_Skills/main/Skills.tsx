import {
	findProjectSkills,
	installProjectSkill,
	uninstallProjectSkill,
	useAgentSnapshot
} from "@renderer/agentStore"
import type { AgentSkillSuggestion } from "src/main/agent/contracts"
import { motion } from "motion/react"
import type { FormEvent } from "react"
import { useState } from "react"
import { InstalledSkillTable, InstallSkillModal, SkillTable } from "./SkillTables"
import {
	type InstalledSkill,
	refreshInstalledSkills,
	useInstalledSkills
} from "./installedSkillsStore"

interface Props {
	projectPath: string
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
						className="polished-button min-w-24 cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isScanning ? "Scanning..." : "Find Skills"}
					</button>
				</div>

				{latestSkillActivity ? (
					<motion.div
						initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ type: "spring", duration: 0.3, bounce: 0 }}
						className="polished-surface rounded-md border border-white/8 bg-neutral-900 px-3 py-2 text-xs text-neutral-400"
					>
						{latestSkillActivity.summary}
					</motion.div>
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
