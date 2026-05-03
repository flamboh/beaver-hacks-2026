import { useMemo, useSyncExternalStore } from "react"

export interface InstalledSkill {
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

export function useInstalledSkills(projectPath: string): InstalledSkill[] {
	const subscribe = useMemo(
		() => (listener: () => void) => subscribeInstalledSkills(projectPath, listener),
		[projectPath]
	)
	const read = useMemo(() => () => getInstalledSkillsSnapshot(projectPath), [projectPath])
	return useSyncExternalStore(subscribe, read, read)
}

export async function refreshInstalledSkills(projectPath: string): Promise<InstalledSkill[]> {
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
