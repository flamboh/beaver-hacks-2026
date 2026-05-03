import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from "react"

export type SessionProject = {
	id: string
	name: string
	path: string
}

type SessionData = {
	project: SessionProject | null
	setProject: (project: SessionProject) => void
	clearProject: () => void
}

const SessionDataContext = createContext<SessionData | null>(null)

export function SessionDataProvider({ children }: { children: ReactNode }) {
	const [project, setProject] = useState<SessionProject | null>(null)

	const sessionData = useMemo(
		() => ({
			project,
			setProject,
			clearProject: () => setProject(null)
		}),
		[project]
	)

	return createElement(SessionDataContext.Provider, { value: sessionData }, children)
}

export function useSessionData(): SessionData {
	const sessionData = useContext(SessionDataContext)

	if (!sessionData) {
		throw new Error("useSessionData must be used within SessionDataProvider.")
	}

	return sessionData
}
