import { findProjectSkills, useAgentSnapshot } from "@renderer/agentStore"
import type { AgentSkillSuggestion } from "src/main/agent/contracts"
import { useState } from "react"

interface Props {
	projectPath: string
}

export default function Skills({ projectPath }: Props) {
	const [isScanning, setIsScanning] = useState(false)
	const snapshot = useAgentSnapshot()
	const threadId = `skills:${projectPath}`
	const thread = snapshot.threads.find((thread) => thread.id === threadId) ?? null
	const suggestions = thread?.suggestedSkills ?? []
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

	return (
		<section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-sm font-medium text-white">Skills</h1>
					<p className="mt-1 truncate font-mono text-xs text-neutral-600">{projectPath}</p>
				</div>
				<button
					type="button"
					onClick={() => void scanSkills()}
					disabled={isScanning}
					className="min-w-24 cursor-pointer rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isScanning ? "Scanning..." : "Skills"}
				</button>
			</div>

			{latestSkillActivity ? (
				<div className="rounded-md border border-white/8 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
					{latestSkillActivity.summary}
				</div>
			) : null}

			<div className="overflow-hidden rounded-lg border border-white/8 bg-neutral-900">
				{suggestions.length > 0 ? (
					<ul className="divide-y divide-white/5">
						{suggestions.map((skill) => (
							<SkillRow key={skill.id} skill={skill} />
						))}
					</ul>
				) : (
					<div className="px-4 py-10 text-center text-xs text-neutral-600">
						No skills scanned yet.
					</div>
				)}
			</div>
		</section>
	)
}

function SkillRow({ skill }: { skill: AgentSkillSuggestion }) {
	return (
		<li className="flex items-start gap-4 px-4 py-3">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-sm font-medium text-neutral-100">{skill.name}</h2>
					<span className="shrink-0 rounded border border-white/8 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-neutral-600">
						{skill.sourceType}
					</span>
					{skill.installed ? (
						<span className="shrink-0 rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
							Installed
						</span>
					) : null}
				</div>
				<p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">{skill.description}</p>
				<div className="mt-2 flex min-w-0 items-center gap-3 text-xs text-neutral-700">
					<span className="truncate font-mono">{skill.slug}</span>
					<span>{skill.installs.toLocaleString()} installs</span>
				</div>
			</div>
		</li>
	)
}
