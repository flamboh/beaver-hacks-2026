import { readdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

interface InstalledSkill {
  name: string
  path: string
}

const execFileAsync = promisify(execFile)
const PROJECT_SKILL_DIRS = [
  path.join('.agents', 'skills'),
  path.join('.codex', 'skills'),
  path.join('.claude', 'skills'),
  'skills'
]

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

async function readSkillName(skillPath: string): Promise<string | null> {
  const contents = await readFile(path.join(skillPath, 'SKILL.md'), 'utf8')
  const match = contents.match(/^name:\s*"?([^"\n]+)"?/m)
  return match?.[1]?.trim() ?? path.basename(skillPath)
}

async function listRoot(root: string): Promise<InstalledSkill[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const skills = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const skillPath = path.join(root, entry.name)
          return {
            name: (await readSkillName(skillPath)) ?? entry.name,
            path: skillPath
          }
        })
    )
    return skills
  } catch {
    return []
  }
}

function parseSkillsList(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.match(/([^\s@]+\/[^\s@]+)@([^\s]+)/)?.slice(1, 3))
    .filter((match): match is string[] => Boolean(match))
    .flatMap(([source, slug]) => [normalize(slug), normalize(`${source}@${slug}`)])
}

async function listCliProjectSkillKeys(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('npx', ['skills', 'list'], {
      cwd,
      timeout: 15_000
    })
    return parseSkillsList(stdout)
  } catch {
    return []
  }
}

export async function listInstalledSkillKeys(cwd: string): Promise<Set<string>> {
  const roots = await Promise.all(PROJECT_SKILL_DIRS.map((root) => listRoot(path.join(cwd, root))))
  const cliKeys = await listCliProjectSkillKeys(cwd)
  return new Set(
    roots
      .flat()
      .flatMap((skill) => [normalize(skill.name), normalize(path.basename(skill.path))])
      .concat(cliKeys)
  )
}

export function matchesInstalledSkill(
  installedKeys: Set<string>,
  skill: { slug: string; name: string; installUrl?: string | null; id?: string }
): boolean {
  return (
    installedKeys.has(normalize(skill.slug)) ||
    installedKeys.has(normalize(skill.name)) ||
    Boolean(skill.installUrl && installedKeys.has(normalize(skill.installUrl))) ||
    Boolean(skill.id && installedKeys.has(normalize(skill.id.replace(/\//g, '@'))))
  )
}
