import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { ipcMain } from "electron"

export interface SaveScopeFileInput {
	projectPath: string
	fileName: string
	contents: string
}

export interface SaveScopeFileResult {
	path: string
	relativePath: string
}

function normalizeScopeFileName(fileName: string): string {
	const withoutDirectory = path.basename(fileName.trim())
	const withoutExtension = withoutDirectory.replace(/\.(md|markdown)$/i, "")
	const normalized = withoutExtension
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "")

	if (!normalized) throw new Error("Scope file name is required.")
	return `${normalized}.md`
}

async function saveScopeFile(input: SaveScopeFileInput): Promise<SaveScopeFileResult> {
	const projectPath = input.projectPath.trim()
	if (!projectPath) throw new Error("Project path is required.")

	const fileName = normalizeScopeFileName(input.fileName)
	const scopesPath = path.join(projectPath, "scopes")
	const filePath = path.join(scopesPath, fileName)

	await mkdir(scopesPath, { recursive: true })
	await writeFile(filePath, input.contents, "utf8")

	return {
		path: filePath,
		relativePath: `./scopes/${fileName}`
	}
}

export function registerScopeFileIpc(): void {
	ipcMain.handle("scope-file:save", (_event, input: SaveScopeFileInput) => saveScopeFile(input))
}
