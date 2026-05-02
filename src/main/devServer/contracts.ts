export interface ReviewDevServerLaunch {
	url: string
	status: "starting" | "running"
	pid: number | null
	message: string
	output: string
}
