import { spawn, type ChildProcess } from "node:child_process"
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
const SHELL_COMMAND = process.platform === "win32" ? "cmd.exe" : "sh"
const SHELL_ARGS = process.platform === "win32" ? ["/d", "/s", "/c"] : ["-lc"]
const DEV_SHELL_ARGS = process.platform === "win32" ? ["/d", "/s", "/c"] : ["-c"]
const DEV_PORT = process.platform === "win32" ? "%PORT%" : '"$PORT"'

interface DevServerProcess {
	child: ChildProcess
	output: string
	cwd: string
	appName: string
	url: string
	ready: boolean
	stopping: boolean
	aliasedPort: string | null
}

interface DevServerAction {
	command: string[]
	setup: string[]
}

interface PackageManifest {
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	packageManager?: string
	scripts?: Record<string, string>
}

export class DevServerService {
	private readonly projects = new Map<string, DevServerProcess>()
	private readonly launches = new Map<string, Promise<ProjectDevServerLaunch>>()

	async launchProject(input: LaunchProjectDevServerInput): Promise<ProjectDevServerLaunch> {
		const existing = this.running(this.projects.get(input.cwd) ?? null)
		if (existing) {
			if (existing.stopping) throw new Error("Project dev server is stopping.")
			if (existing.ready) {
				if (input.openExternal !== false) void shell.openExternal(existing.url)
				return this.snapshot(existing, "running", "Project")
			}
		}

		const pending = this.launches.get(input.cwd)
		if (pending) return pending

		const launch = existing
			? this.finishLaunch(existing, input.openExternal !== false)
			: this.startProject(input)
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
		const url = this.projectUrl(appName)
		if (await this.canReach(url)) {
			if (input.openExternal !== false) void shell.openExternal(url)
			return {
				url,
				status: "running",
				pid: null,
				message: "Project dev server ready.",
				output: "",
				cwd: input.cwd,
				appName
			}
		}
		const action = await this.projectDevAction(input.cwd, input.enterDevAction)
		await this.runSetup(input.cwd, action.setup)
		await this.runPortless(["alias", "--remove", appName])
		const server = this.spawnServer({
			cwd: input.cwd,
			appName,
			url,
			command: this.portlessBin(),
			args: [appName, ...action.command]
		})
		this.projects.set(input.cwd, server)
		return this.finishLaunch(server, input.openExternal !== false)
	}

	private async finishLaunch(
		server: DevServerProcess,
		openExternal = true
	): Promise<ProjectDevServerLaunch> {
		server.ready = await this.waitForUrl(server.url)
		if (server.ready) {
			await this.delay(READY_SETTLE_MS)
			if (openExternal) void shell.openExternal(server.url)
		}
		return this.snapshot(server, server.ready ? "running" : "starting", "Project")
	}

	async status(input: ProjectDevServerInput): Promise<ProjectDevServerStatus> {
		const server = this.running(this.projects.get(input.cwd) ?? null)
		if (server) {
			return {
				status: server.stopping ? "stopping" : server.ready ? "running" : "starting",
				url: server.url,
				pid: server.child.pid ?? null,
				cwd: server.cwd,
				appName: server.appName
			}
		}
		const appName = this.projectAppName(input)
		const url = this.projectUrl(appName)
		return {
			status: (await this.canReach(url)) ? "running" : "stopped",
			url,
			pid: null,
			cwd: input.cwd,
			appName
		}
	}

	async stopProject(input: ProjectDevServerInput): Promise<ProjectDevServerStatus> {
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
				env: {
					...process.env,
					BROWSER: "none",
					PORTLESS_PORT: this.proxyPort()
				},
				stdio: ["ignore", "pipe", "pipe"]
			}),
			output: "",
			cwd: input.cwd,
			appName: input.appName,
			url: input.url,
			ready: false,
			stopping: false,
			aliasedPort: null
		}

		server.child.stdout?.on("data", (data: Buffer) => this.appendServerOutput(server, data))
		server.child.stderr?.on("data", (data: Buffer) => this.appendServerOutput(server, data))
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

	private appendServerOutput(server: DevServerProcess, data: Buffer): void {
		this.appendOutput(server, data)
		const port = this.outputPort(server.output)
		if (port && server.aliasedPort !== port) {
			server.aliasedPort = port
			void this.registerAlias(server.appName, port).catch((error: Error) =>
				this.appendOutput(server, error.message)
			)
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

	private async projectDevAction(cwd: string, setupAction?: string): Promise<DevServerAction> {
		const command = await this.inferDevCommand(cwd)
		const setup = (setupAction ?? "")
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter(Boolean)
			.filter((line) => !this.isDevCommand(line, command))
		return {
			command,
			setup
		}
	}

	private isDevCommand(line: string, command: string[]): boolean {
		if (line === command.join(" ")) return true
		return /^(bun|pnpm|yarn) (run )?dev(\s|$)|^npm run dev(\s|$)/u.test(line)
	}

	private async inferDevCommand(cwd: string): Promise<string[]> {
		const manifestPath = join(cwd, "package.json")
		if (!existsSync(manifestPath)) {
			throw new Error(`Project package.json not found at ${manifestPath}.`)
		}
		const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest
		if (!manifest.scripts?.dev) throw new Error("Project package.json has no dev script.")
		const manager = this.packageManager(cwd, manifest)
		if (this.needsExplicitPort(manifest)) {
			return [
				SHELL_COMMAND,
				...DEV_SHELL_ARGS,
				`${this.devScriptCommand(manager)} -- --host 127.0.0.1 --port ${DEV_PORT}`
			]
		}
		if (manager === "bun") return ["bun", "run", "dev"]
		if (manager === "pnpm") return ["pnpm", "run", "dev"]
		if (manager === "yarn") return ["yarn", "dev"]
		return ["npm", "run", "dev"]
	}

	private devScriptCommand(manager: string): string {
		if (manager === "bun") return "bun run dev"
		if (manager === "pnpm") return "pnpm run dev"
		if (manager === "yarn") return "yarn dev"
		return "npm run dev"
	}

	private needsExplicitPort(manifest: PackageManifest): boolean {
		const dependencies = {
			...manifest.dependencies,
			...manifest.devDependencies
		}
		return Boolean(dependencies.astro || dependencies.vite)
	}

	private packageManager(cwd: string, manifest: PackageManifest): string {
		const declared = manifest.packageManager?.split("@")[0]
		if (declared) return declared
		if (existsSync(join(cwd, "bun.lock"))) return "bun"
		if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm"
		if (existsSync(join(cwd, "yarn.lock"))) return "yarn"
		return "npm"
	}

	private async runSetup(cwd: string, commands: string[]): Promise<void> {
		for (const command of commands) {
			await new Promise<void>((resolve, reject) => {
				const child = spawn(SHELL_COMMAND, [...SHELL_ARGS, command], {
					cwd,
					env: { ...process.env, BROWSER: "none" },
					stdio: ["ignore", "pipe", "pipe"]
				})
				let output = ""
				const append = (data: Buffer | string): void => {
					output = `${output}${data.toString()}`
					if (output.length > OUTPUT_LIMIT) output = output.slice(-OUTPUT_LIMIT)
				}
				child.stdout?.on("data", append)
				child.stderr?.on("data", append)
				child.on("error", reject)
				child.on("exit", (code) => {
					if (code === 0) {
						resolve()
						return
					}
					reject(new Error(output.trim() || `Project setup command failed: ${command}`))
				})
			})
		}
	}

	private projectAppName(input: { cwd: string; name?: string }): string {
		const hash = this.stableHash(input.cwd)
		const slug = (input.name || basename(input.cwd))
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/(^-|-$)/g, "")
			.slice(0, 32)
		return `beaver-${slug || "project"}-${hash}`
	}

	private stableHash(value: string): string {
		let hash = 0x811c9dc5
		for (let index = 0; index < value.length; index += 1) {
			hash ^= value.charCodeAt(index)
			hash = Math.imul(hash, 0x01000193)
		}
		return (hash >>> 0).toString(16).padStart(8, "0")
	}

	private portlessBin(): string {
		const binary = process.platform === "win32" ? "portless.cmd" : "portless"
		return join(process.cwd(), "node_modules", ".bin", binary)
	}

	private async registerAlias(appName: string, port: string): Promise<void> {
		await this.runPortless(["alias", "--remove", appName])
		await this.runPortless(["alias", appName, port])
	}

	private runPortless(args: string[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const child = spawn(this.portlessBin(), args, {
				env: { ...process.env, PORTLESS_PORT: this.proxyPort() },
				stdio: "ignore"
			})
			child.on("error", reject)
			child.on("exit", (code) => {
				if (code === 0 || args.includes("--remove")) {
					resolve()
					return
				}
				reject(new Error("Failed to register dev server URL."))
			})
		})
	}

	private outputPort(output: string): string | null {
		return output.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)?.[1] ?? null
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
