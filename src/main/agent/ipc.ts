import { BrowserWindow, ipcMain } from "electron"
import { AgentEngine } from "./agentEngine"

import type {
	AgentProvider,
	FindMcpsInput,
	FindSkillsInput,
	InstallSkillInput,
	SpawnThreadInput,
	StopTurnInput,
	StartTurnInput,
	UninstallSkillInput
} from "./contracts"

const SNAPSHOT_EVENT = "agent:snapshot"

export function registerAgentIpc(engine: AgentEngine): void {
	ipcMain.handle("agent:get-snapshot", () => engine.getSnapshot())
	ipcMain.handle("agent:list-models", (_event, provider: AgentProvider) =>
		engine.listModels(provider)
	)
	ipcMain.handle("agent:get-semgrep-status", () => engine.getSemgrepStatus())
	ipcMain.handle("agent:start-turn", (_event, input: StartTurnInput) => engine.startTurn(input))
	ipcMain.handle("agent:find-skills", (_event, input: FindSkillsInput) => engine.findSkills(input))
	ipcMain.handle("agent:find-mcps", (_event, input: FindMcpsInput) => engine.findMcps(input))
	ipcMain.handle("agent:install-skill", (_event, input: InstallSkillInput) =>
		engine.installSkill(input)
	)
	ipcMain.handle("agent:uninstall-skill", (_event, input: UninstallSkillInput) =>
		engine.uninstallSkill(input)
	)
	ipcMain.handle("agent:spawn-thread", (_event, input: SpawnThreadInput) =>
		engine.spawnThread(input)
	)
	ipcMain.handle("agent:stop-turn", (_event, input: StopTurnInput) => engine.stopTurn(input))

	engine.onSnapshot((snapshot) => {
		for (const window of BrowserWindow.getAllWindows()) {
			window.webContents.send(SNAPSHOT_EVENT, snapshot)
		}
	})
}

export type {
	AgentModelOption,
	AgentProvider,
	AgentSnapshot,
	FindMcpsInput,
	SemgrepStatus,
	FindSkillsInput,
	InstallSkillInput,
	SpawnThreadInput,
	StopTurnInput,
	StartTurnInput,
	UninstallSkillInput
} from "./contracts"
export { SNAPSHOT_EVENT }
