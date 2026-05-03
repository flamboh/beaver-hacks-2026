import { BrowserWindow, ipcMain } from "electron"
import { AgentEngine } from "./agentEngine"
import type { GenerateAgentNameInput, GenerateAgentNameResult } from "./agentNaming"
import type { AgentSnapshot, FindSkillsInput, InstallSkillInput, StartTurnInput } from "./contracts"

const SNAPSHOT_EVENT = "agent:snapshot"

export function registerAgentIpc(engine: AgentEngine): void {
	ipcMain.handle("agent:get-snapshot", () => engine.getSnapshot())
	ipcMain.handle("agent:start-turn", (_event, input: StartTurnInput) => engine.startTurn(input))
	ipcMain.handle("agent:find-skills", (_event, input: FindSkillsInput) => engine.findSkills(input))
	ipcMain.handle("agent:install-skill", (_event, input: InstallSkillInput) =>
		engine.installSkill(input)
	)
	ipcMain.handle(
		"agent:generate-name",
		(_event, input: GenerateAgentNameInput): Promise<GenerateAgentNameResult> =>
			engine.generateAgentName(input)
	)

	engine.onSnapshot((snapshot) => {
		for (const window of BrowserWindow.getAllWindows()) {
			window.webContents.send(SNAPSHOT_EVENT, snapshot)
		}
	})
}

export type {
	AgentSnapshot,
	FindSkillsInput,
	GenerateAgentNameInput,
	GenerateAgentNameResult,
	InstallSkillInput,
	StartTurnInput
}
export { SNAPSHOT_EVENT }
