import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const INSTALL_TIMEOUT_MS = 120_000

export async function installProjectSkill(cwd: string, installUrl: string): Promise<void> {
  await execFileAsync('npx', ['skills', 'add', installUrl, '-y'], {
    cwd,
    timeout: INSTALL_TIMEOUT_MS
  })
}
