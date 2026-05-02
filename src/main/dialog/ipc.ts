import { BrowserWindow, dialog, ipcMain } from "electron"

export function registerDialogIpc(): void {
	ipcMain.handle("dialog:select-directory", async (event) => {
		const window = BrowserWindow.fromWebContents(event.sender)
		const result = window
			? await dialog.showOpenDialog(window, { properties: ["openDirectory"] })
			: await dialog.showOpenDialog({ properties: ["openDirectory"] })

		return result.canceled ? null : (result.filePaths[0] ?? null)
	})
}
