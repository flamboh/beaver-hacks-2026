import { execFile } from 'node:child_process'
import type {
  GitBranch,
  GitCommitAllInput,
  GitCommitMessage,
  GitCommitResult,
  GitCreateBranchInput,
  GitFileChange,
  GitPushInput,
  GitPushResult,
  GitStatusSnapshot
} from './contracts'

interface GitResult {
  stdout: string
  stderr: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024
const COMMIT_CONTEXT_MAX_BUFFER = 256 * 1024
const MINI_MODEL = 'gpt-5.4-mini'

function nowIso(): string {
  return new Date().toISOString()
}

function runGit(
  cwd: string,
  args: readonly string[],
  maxBuffer = DEFAULT_MAX_BUFFER
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...args],
      { cwd, timeout: DEFAULT_TIMEOUT_MS, maxBuffer },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message).trim()))
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

function parseBranchAb(line: string): { ahead: number; behind: number } {
  const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line.trim())
  return {
    ahead: Number(match?.[1] ?? '0'),
    behind: Number(match?.[2] ?? '0')
  }
}

function parseStatusPath(line: string): string | null {
  if (line.startsWith('? ') || line.startsWith('! ')) {
    const path = line.slice(2).trim()
    return path.length > 0 ? path : null
  }

  if (line.startsWith('1 ')) {
    const fields = line.trim().split(/\s+/g)
    const path = fields.slice(8).join(' ').trim()
    return path.length > 0 ? path : null
  }

  if (line.startsWith('u ')) {
    const fields = line.trim().split(/\s+/g)
    const path = fields.slice(10).join(' ').trim()
    return path.length > 0 ? path : null
  }

  if (line.startsWith('2 ')) {
    const fields = line.split('\t')[0]?.trim().split(/\s+/g) ?? []
    const path = fields.slice(9).join(' ').trim()
    return path.length > 0 ? path : null
  }

  const tabParts = line.split('\t')
  const fromTab = tabParts.at(-1)?.trim() ?? ''
  if (fromTab.length > 0 && tabParts.length > 1) return fromTab

  const spaceParts = line.trim().split(/\s+/g)
  const path = spaceParts.at(-1)?.trim() ?? ''
  return path.length > 0 ? path : null
}

function parseFileStatus(line: string): string {
  if (line.startsWith('? ')) return 'untracked'
  if (line.startsWith('! ')) return 'ignored'
  if (line.startsWith('u ')) return 'conflict'
  if (line.startsWith('2 ')) return 'renamed'
  if (line.startsWith('1 ')) return line.slice(2, 4).trim() || 'modified'
  return 'modified'
}

function parseStatus(stdout: string): {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  files: GitFileChange[]
} {
  let branch: string | null = null
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  const files: GitFileChange[] = []

  for (const line of stdout.split(/\r?\n/g)) {
    if (line.startsWith('# branch.head ')) {
      const value = line.slice('# branch.head '.length).trim()
      branch = value === '(detached)' ? null : value
      continue
    }
    if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length).trim() || null
      continue
    }
    if (line.startsWith('# branch.ab ')) {
      const parsed = parseBranchAb(line)
      ahead = parsed.ahead
      behind = parsed.behind
      continue
    }
    if (line.length === 0 || line.startsWith('# ')) continue

    const path = parseStatusPath(line)
    if (path) files.push({ path, status: parseFileStatus(line) })
  }

  return { branch, upstream, ahead, behind, files }
}

function parseBranches(stdout: string, currentBranch: string | null): GitBranch[] {
  return stdout
    .split(/\r?\n/g)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((name) => ({ name, current: name === currentBranch }))
}

function parseNumstat(stdout: string): { insertions: number; deletions: number } {
  let insertions = 0
  let deletions = 0
  for (const line of stdout.split(/\r?\n/g)) {
    const [addedRaw, deletedRaw] = line.split('\t')
    const added = Number.parseInt(addedRaw ?? '0', 10)
    const deleted = Number.parseInt(deletedRaw ?? '0', 10)
    insertions += Number.isFinite(added) ? added : 0
    deletions += Number.isFinite(deleted) ? deleted : 0
  }
  return { insertions, deletions }
}

function normalizeBranchName(branch: string): string {
  return branch
    .trim()
    .replace(/[^A-Za-z0-9._/-]+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
}

export class GitService {
  async status(cwd: string): Promise<GitStatusSnapshot> {
    try {
      await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
    } catch {
      return {
        cwd,
        isRepo: false,
        branch: null,
        upstream: null,
        ahead: 0,
        behind: 0,
        hasRemote: false,
        files: [],
        insertions: 0,
        deletions: 0,
        branches: [],
        updatedAt: nowIso()
      }
    }

    const statusResult = await runGit(cwd, ['status', '--porcelain=v2', '--branch'])
    const parsed = parseStatus(statusResult.stdout)
    const [branchesResult, remotesResult, numstatResult] = await Promise.all([
      runGit(cwd, ['branch', '--format=%(refname:short)']),
      runGit(cwd, ['remote']),
      runGit(cwd, ['diff', '--numstat', 'HEAD', '--']).catch(() => ({ stdout: '', stderr: '' }))
    ])
    const stats = parseNumstat(numstatResult.stdout)

    return {
      cwd,
      isRepo: true,
      branch: parsed.branch,
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      hasRemote: remotesResult.stdout.trim().length > 0,
      files: parsed.files,
      insertions: stats.insertions,
      deletions: stats.deletions,
      branches: parseBranches(branchesResult.stdout, parsed.branch),
      updatedAt: nowIso()
    }
  }

  async checkout(input: { cwd: string; branch: string }): Promise<GitStatusSnapshot> {
    const branch = normalizeBranchName(input.branch)
    if (!branch) throw new Error('Branch required.')
    await runGit(input.cwd, ['checkout', branch])
    return this.status(input.cwd)
  }

  async createBranch(input: GitCreateBranchInput): Promise<GitStatusSnapshot> {
    const branch = normalizeBranchName(input.branch)
    if (!branch) throw new Error('Branch required.')
    await runGit(input.cwd, ['checkout', '-b', branch])
    return this.status(input.cwd)
  }

  async commitAll(input: GitCommitAllInput): Promise<GitCommitResult> {
    const subject = input.subject.trim()
    const body = input.body?.trim() ?? ''
    if (!subject) throw new Error('Commit subject required.')

    await runGit(input.cwd, ['add', '-A', '--', '.'])
    const args = ['commit', '-m', subject]
    if (body) args.push('-m', body)
    await runGit(input.cwd, args, DEFAULT_MAX_BUFFER)
    const commitSha = (await runGit(input.cwd, ['rev-parse', '--short=12', 'HEAD'])).stdout.trim()
    return {
      commitSha,
      status: await this.status(input.cwd)
    }
  }

  async push(input: GitPushInput): Promise<GitPushResult> {
    const snapshot = await this.status(input.cwd)
    if (!snapshot.branch) throw new Error('Cannot push detached HEAD.')
    const args = snapshot.upstream
      ? ['push']
      : ['push', '--set-upstream', 'origin', snapshot.branch]
    await runGit(input.cwd, args, DEFAULT_MAX_BUFFER)
    return { status: await this.status(input.cwd) }
  }

  async buildCommitPrompt(cwd: string): Promise<string> {
    const [status, stat, patch] = await Promise.all([
      this.status(cwd),
      runGit(cwd, ['diff', '--stat', 'HEAD', '--'], COMMIT_CONTEXT_MAX_BUFFER).catch(() => ({
        stdout: '',
        stderr: ''
      })),
      runGit(
        cwd,
        ['diff', '--patch', '--minimal', '--no-color', 'HEAD', '--'],
        COMMIT_CONTEXT_MAX_BUFFER
      ).catch(() => ({ stdout: '', stderr: '' }))
    ])

    const changedFiles = status.files.map((file) => `${file.status}\t${file.path}`).join('\n')
    return [
      'Write a Conventional Commit message for these git changes.',
      'Return only JSON: {"subject":"type(scope): summary","body":"optional body"}.',
      'Use present tense. Keep subject under 72 chars. No markdown.',
      '',
      `Branch: ${status.branch ?? 'detached'}`,
      `Files:\n${changedFiles || '(none)'}`,
      `Stat:\n${stat.stdout.trim() || '(none)'}`,
      `Patch:\n${patch.stdout.slice(0, 24_000).trim() || '(not available)'}`
    ].join('\n')
  }

  parseCommitMessage(raw: string): GitCommitMessage {
    const match = /\{[\s\S]*\}/.exec(raw.trim())
    if (!match) throw new Error('Mini model did not return JSON.')
    const parsed = JSON.parse(match[0]) as GitCommitMessage
    return {
      subject: parsed.subject.trim(),
      body: parsed.body?.trim() ?? ''
    }
  }
}

export { MINI_MODEL }
