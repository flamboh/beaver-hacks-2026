import { spawn, type ChildProcess } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { get } from "node:https"
import { basename, join } from "node:path"
import { shell } from "electron"
import type {
	LaunchProjectDevServerInput,
	ProjectDevServerInput,
	ProjectDevServerLaunch,
	ProjectDevServerStatus
} from "./contracts"

const OUTPUT_LIMIT = 4000
const STARTUP_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 250
const READY_SETTLE_MS = 600

interface PackageManifest {
	packageManager?: string
	scripts?: Record<string, string>
	beaver?: {
		devServer?: {
			command?: string | string[]
		}
	}
}

interface DevServerProcess {
	child: ChildProcess
	output: string
	cwd: string
	appName: string
	url: string
	ready: boolean
	stopping: boolean
}

export class DevServerService {
	private readonly projects = new Map<string, DevServerProcess>()
	private readonly launches = new Map<string, Promise<ProjectDevServerLaunch>>()

	async launchProject(input: LaunchProjectDevServerInput): Promise<ProjectDevServerLaunch> {
		const existing = this.running(this.projects.get(input.cwd) ?? null)
		if (existing) {
			if (existing.stopping) throw new Error("Project dev server is stopping.")
			if (existing.ready) {
				void shell.openExternal(existing.url)
				return this.snapshot(existing, "running", "Project")
			}
		}

		const pending = this.launches.get(input.cwd)
		if (pending) return pending

		const launch = existing ? this.finishLaunch(existing) : this.startProject(input)
		this.launches.set(input.cwd, launch)
		try {
			return await launch
		} finally {
			if (this.launches.get(input.cwd) === launch) this.launches.delete(input.cwd)
		}
	}

	private async startProject(input: LaunchProjectDevServerInput): Promise<ProjectDevServerLaunch> {
		await this.assertDirectory(input.cwd)
		const appName = this.projectAppName(input)
		const command = await this.projectDevCommand(input.cwd)
		const server = this.spawnServer({
			cwd: input.cwd,
			appName,
			url: this.projectUrl(appName),
			command: this.portlessBin(),
			args: [appName, "--force", ...command]
		})
		this.projects.set(input.cwd, server)
		return this.finishLaunch(server)
	}

	private async finishLaunch(server: DevServerProcess): Promise<ProjectDevServerLaunch> {
		server.ready = await this.waitForUrl(server.url)
		if (server.ready) {
			await this.delay(READY_SETTLE_MS)
			void shell.openExternal(server.url)
		}
		return this.snapshot(server, server.ready ? "running" : "starting", "Project")
	}

	status(input: ProjectDevServerInput): ProjectDevServerStatus {
		const server = this.running(this.projects.get(input.cwd) ?? null)
		if (!server) {
			return {
				status: "stopped",
				url: null,
				pid: null,
				cwd: input.cwd,
				appName: null
			}
		}
		return {
			status: server.stopping ? "stopping" : server.ready ? "running" : "starting",
			url: server.url,
			pid: server.child.pid ?? null,
			cwd: server.cwd,
			appName: server.appName
		}
	}

	stopProject(input: ProjectDevServerInput): ProjectDevServerStatus {
		const server = this.running(this.projects.get(input.cwd) ?? null)
		if (!server) return this.status(input)
		server.stopping = true
		if (!server.child.kill()) throw new Error("Failed to stop project dev server.")
		return this.status(input)
	}

	stop(): void {
		const failures: string[] = []
		for (const server of this.projects.values()) {
			server.stopping = true
			if (!server.child.kill()) failures.push(server.cwd)
		}
		if (failures.length > 0) {
			throw new Error(`Failed to stop dev servers: ${failures.join(", ")}`)
		}
	}

	private spawnServer(input: {
		cwd: string
		appName: string
		url: string
		command: string
		args: string[]
	}): DevServerProcess {
		const server: DevServerProcess = {
			child: spawn(input.command, input.args, {
				cwd: input.cwd,
				env: { ...process.env, BROWSER: "none", PORTLESS_PORT: this.proxyPort() },
				stdio: ["ignore", "pipe", "pipe"]
			}),
			output: "",
			cwd: input.cwd,
			appName: input.appName,
			url: input.url,
			ready: false,
			stopping: false
		}

		server.child.stdout?.on("data", (data: Buffer) => this.appendOutput(server, data))
		server.child.stderr?.on("data", (data: Buffer) => this.appendOutput(server, data))
		server.child.on("error", (error) => this.appendOutput(server, error.message))
		server.child.on("exit", () => {
			if (this.projects.get(server.cwd) === server) this.projects.delete(server.cwd)
		})

		return server
	}

	private appendOutput(server: DevServerProcess, data: Buffer | string): void {
		server.output = `${server.output}${data.toString()}`
		if (server.output.length > OUTPUT_LIMIT) {
			server.output = server.output.slice(-OUTPUT_LIMIT)
		}
	}

	private running(server: DevServerProcess | null): DevServerProcess | null {
		return server?.child.exitCode === null ? server : null
	}

	private async waitForUrl(url: string): Promise<boolean> {
		const deadline = Date.now() + STARTUP_TIMEOUT_MS
		while (Date.now() < deadline) {
			if (await this.canReach(url)) return true
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
		}
		return false
	}

	private canReach(url: string): Promise<boolean> {
		return new Promise((resolve) => {
			let settled = false
			const finish = (ready: boolean): void => {
				if (settled) return
				settled = true
				resolve(ready)
			}
			const request = get(url, { rejectUnauthorized: false, timeout: 1000 }, (response) => {
				response.resume()
				finish(response.statusCode !== 404 && (response.statusCode ?? 500) < 500)
			})
			request.on("error", () => finish(false))
			request.on("timeout", () => {
				request.destroy()
				finish(false)
			})
		})
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	private async projectDevCommand(cwd: string): Promise<string[]> {
		const manifest = JSON.parse(
			await readFile(join(cwd, "package.json"), "utf8")
		) as PackageManifest
		const configured = manifest.beaver?.devServer?.command
		if (Array.isArray(configured) && configured.length > 0) return configured
		if (configured && !Array.isArray(configured) && configured.trim()) {
			return this.splitCommand(configured)
		}
		if (!manifest.scripts?.dev) throw new Error("Project package.json has no dev script.")

		const devCommand = this.splitCommand(manifest.scripts.dev)
		if (this.isSimpleCommand(devCommand)) {
			return [...this.execRunner(cwd, manifest), ...devCommand]
		}

		return [...this.scriptRunner(cwd, manifest), "dev"]
	}

	private execRunner(cwd: string, manifest: PackageManifest): string[] {
		const manager = this.packageManager(cwd, manifest)
		if (manager === "bun") return ["bunx"]
		if (manager === "npm") return ["npx"]
		if (manager === "yarn") return ["yarn", "exec"]
		return ["pnpm", "exec"]
	}

	private scriptRunner(cwd: string, manifest: PackageManifest): string[] {
		const manager = this.packageManager(cwd, manifest)
		if (manager === "bun") return ["bun", "run"]
		if (manager === "npm") return ["npm", "run"]
		if (manager === "yarn") return ["yarn"]
		return ["pnpm", "run"]
	}

	private packageManager(cwd: string, manifest: PackageManifest): string {
		const declared = manifest.packageManager?.split("@")[0]
		if (declared) return declared
		if (existsSync(join(cwd, "bun.lock"))) return "bun"
		if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm"
		if (existsSync(join(cwd, "package-lock.json"))) return "npm"
		if (existsSync(join(cwd, "yarn.lock"))) return "yarn"
		return "pnpm"
	}

	private splitCommand(command: string): string[] {
		return (
			command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((part) => {
				if (
					(part.startsWith('"') && part.endsWith('"')) ||
					(part.startsWith("'") && part.endsWith("'"))
				) {
					return part.slice(1, -1)
				}
				return part
			}) ?? []
		)
	}

	private isSimpleCommand(command: string[]): boolean {
		if (command.length === 0) return false
		return command.every((part) => !/[;&|<>$`]/.test(part) && !part.includes("="))
	}

	private projectAppName(input: LaunchProjectDevServerInput): string {
		const hash = createHash("sha1").update(input.cwd).digest("hex").slice(0, 8)
		const slug = (input.name || basename(input.cwd))
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/(^-|-$)/g, "")
			.slice(0, 32)
		return `beaver-${slug || "project"}-${hash}`
	}

	private portlessBin(): string {
		const binary = process.platform === "win32" ? "portless.cmd" : "portless"
		return join(process.cwd(), "node_modules", ".bin", binary)
	}

	private projectUrl(appName: string): string {
		const port = this.proxyPort()
		return `https://${appName}.localhost${port === "443" ? "" : `:${port}`}`
	}

	private proxyPort(): string {
		return process.env.PORTLESS_PORT || "1355"
	}

	private async assertDirectory(cwd: string): Promise<void> {
		const info = await stat(cwd)
		if (!info.isDirectory()) throw new Error("Project path is not a directory.")
	}

	private snapshot(
		server: DevServerProcess,
		status: ProjectDevServerLaunch["status"],
		label: string
	): ProjectDevServerLaunch {
		return {
			url: server.url,
			status,
			pid: server.child.pid ?? null,
			message:
				status === "running" ? `${label} dev server ready.` : `${label} dev server launching.`,
			output: server.output.trim(),
			cwd: server.cwd,
			appName: server.appName
		}
	}
}
