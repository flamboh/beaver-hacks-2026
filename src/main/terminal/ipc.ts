import { ipcMain } from "electron"
import { TerminalService } from "./terminalService"
import type { TerminalRunInput } from "./contracts"

export function registerTerminalIpc(terminal: TerminalService): void {
	ipcMain.handle("terminal:run", (_event, input: TerminalRunInput) => terminal.run(input))
}

export type { TerminalRunInput, TerminalRunResult } from "./contracts"
