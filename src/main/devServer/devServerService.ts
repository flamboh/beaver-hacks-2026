import { spawn, type ChildProcess } from "node:child_process"
import { get } from "node:https"
import { shell } from "electron"
import type { ReviewDevServerLaunch } from "./contracts"

const REVIEW_APP_NAME = "beaver-review"
const REVIEW_URL = `https://${REVIEW_APP_NAME}.localhost/#/workbench/review`
const OUTPUT_LIMIT = 4000
const STARTUP_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 250

export class DevServerService {
	private child: ChildProcess | null = null
	private output = ""

	async launchReview(): Promise<ReviewDevServerLaunch> {
		const runningChild = this.child?.exitCode === null ? this.child : null

		if (!runningChild) {
			this.output = ""
			const child = spawn("pnpm", ["run", "dev:review:portless"], {
				cwd: process.cwd(),
				env: { ...process.env, BROWSER: "none" },
				stdio: ["ignore", "pipe", "pipe"]
			})
			this.child = child

			child.stdout?.on("data", (data: Buffer) => this.appendOutput(data))
			child.stderr?.on("data", (data: Buffer) => this.appendOutput(data))
			child.on("error", (error) => this.appendOutput(error.message))
			child.on("exit", () => {
				this.child = null
			})
		}

		const ready = runningChild ? true : await this.waitForReview()
		void shell.openExternal(REVIEW_URL)
		return this.snapshot(ready ? "running" : "starting")
	}

	stop(): void {
		this.child?.kill()
		this.child = null
	}

	private appendOutput(data: Buffer | string): void {
		this.output = `${this.output}${data.toString()}`
		if (this.output.length > OUTPUT_LIMIT) {
			this.output = this.output.slice(-OUTPUT_LIMIT)
		}
	}

	private async waitForReview(): Promise<boolean> {
		const deadline = Date.now() + STARTUP_TIMEOUT_MS
		while (Date.now() < deadline) {
			if (await this.canReachReview()) return true
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
		}
		return false
	}

	private canReachReview(): Promise<boolean> {
		return new Promise((resolve) => {
			let settled = false
			const finish = (ready: boolean): void => {
				if (settled) return
				settled = true
				resolve(ready)
			}
			const request = get(REVIEW_URL, { rejectUnauthorized: false, timeout: 1000 }, (response) => {
				response.resume()
				finish(true)
			})
			request.on("error", () => finish(false))
			request.on("timeout", () => {
				request.destroy()
				finish(false)
			})
		})
	}

	private snapshot(status: ReviewDevServerLaunch["status"]): ReviewDevServerLaunch {
		return {
			url: REVIEW_URL,
			status,
			pid: this.child?.pid ?? null,
			message: status === "running" ? "Review dev server ready." : "Review dev server launching.",
			output: this.output.trim()
		}
	}
}
