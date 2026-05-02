import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export interface ProjectFileSummary {
  path: string
  contents: string
}

const PROJECT_FILE_NAMES = new Set(['agents.md', 'claude.md', 'package.json', 'readme.md'])

const MAX_DOC_CHARS = 3_000
const MAX_SCRIPT_COUNT = 12
const MAX_DEP_COUNT = 80

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function trimObjectKeys(value: unknown, maxCount: number): string[] {
  if (!value || Array.isArray(value)) return []
  return Object.keys(value as Record<string, unknown>)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, maxCount)
}

function summarizePackageJson(contents: string): string {
  const parsed = JSON.parse(contents) as {
    name?: string
    description?: string
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  return JSON.stringify({
    name: parsed.name ?? null,
    description: parsed.description ?? null,
    scripts: trimObjectKeys(parsed.scripts, MAX_SCRIPT_COUNT),
    dependencies: trimObjectKeys(parsed.dependencies, MAX_DEP_COUNT),
    devDependencies: trimObjectKeys(parsed.devDependencies, MAX_DEP_COUNT)
  })
}

function summarizeFile(pathName: string, contents: string): string {
  if (pathName.toLowerCase() === 'package.json') return summarizePackageJson(contents)
  return contents.slice(0, MAX_DOC_CHARS)
}

export async function readProjectFiles(cwd: string): Promise<ProjectFileSummary[]> {
  const entries = await readdir(cwd, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && PROJECT_FILE_NAMES.has(entry.name.toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  if (!files.includes('package.json') && (await exists(path.join(cwd, 'package.json')))) {
    files.push('package.json')
  }

  const summaries = await Promise.all(
    files.map(async (file) => ({
      path: file,
      contents: summarizeFile(file, await readFile(path.join(cwd, file), 'utf8'))
    }))
  )

  return summaries
}
