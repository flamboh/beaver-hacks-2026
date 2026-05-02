import { BrowserWindow, ipcMain } from "electron"
import { AgentEngine } from "./agentEngine"
import type { AgentSnapshot, FindSkillsInput, InstallSkillInput, StartTurnInput } from "./contracts"

const SNAPSHOT_EVENT = "agent:snapshot"

export function registerAgentIpc(engine: AgentEngine): void {
	ipcMain.handle("agent:get-snapshot", () => engine.getSnapshot())
	ipcMain.handle("agent:start-turn", (_event, input: StartTurnInput) => engine.startTurn(input))
	ipcMain.handle("agent:find-skills", (_event, input: FindSkillsInput) => engine.findSkills(input))
	ipcMain.handle("agent:install-skill", (_event, input: InstallSkillInput) =>
		engine.installSkill(input)
	)

	engine.onSnapshot((snapshot) => {
		for (const window of BrowserWindow.getAllWindows()) {
			window.webContents.send(SNAPSHOT_EVENT, snapshot)
		}
	})
}

export type { AgentSnapshot, FindSkillsInput, InstallSkillInput, StartTurnInput }
export { SNAPSHOT_EVENT }
