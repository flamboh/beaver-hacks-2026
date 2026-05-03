export interface LaunchProjectDevServerInput {
	cwd: string
	name: string
}

export interface ProjectDevServerInput {
	cwd: string
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
	url: string | null
	pid: number | null
	cwd: string
	appName: string | null
}
