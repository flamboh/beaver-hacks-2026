export interface LaunchProjectDevServerInput {
	cwd: string
	name: string
	enterDevAction?: string
	openExternal?: boolean
}

export interface ProjectDevServerInput {
	cwd: string
	name?: string
}

export interface ProjectDevServerLaunch {
	url: string
	status: "starting" | "running"
	pid: number | null
	message: string
	output: string
	cwd: string
	appName: string
}

export interface ProjectDevServerStatus {
	status: "stopped" | "starting" | "running" | "stopping"
	url: string
	pid: number | null
	cwd: string
	appName: string
}
