import { ipcMain } from "electron"
import { TerminalService } from "./terminalService"
import { TerminalSessionService } from "./terminalSessionService"
import type {
	TerminalCreateInput,
	TerminalDisposeInput,
	TerminalResizeInput,
	TerminalRunInput,
	TerminalWriteInput
} from "./contracts"

export function registerTerminalIpc(
	terminal: TerminalService,
	sessions: TerminalSessionService
): void {
	ipcMain.handle("terminal:run", (_event, input: TerminalRunInput) => terminal.run(input))
	ipcMain.handle("terminal:session:create", (event, input: TerminalCreateInput) =>
		sessions.create(input, event.sender)
	)
	ipcMain.on("terminal:session:write", (_event, input: TerminalWriteInput) => sessions.write(input))
	ipcMain.on("terminal:session:resize", (_event, input: TerminalResizeInput) =>
		sessions.resize(input)
	)
	ipcMain.on("terminal:session:dispose", (_event, input: TerminalDisposeInput) =>
		sessions.dispose(input)
	)
}

export type {
	TerminalCreateInput,
	TerminalCreateResult,
	TerminalDisposeInput,
	TerminalResizeInput,
	TerminalRunInput,
	TerminalRunResult,
	TerminalWriteInput
} from "./contracts"
