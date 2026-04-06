import simpleGit from 'simple-git'
import type { GitFileStatus } from '@shared/types/git'
import type { GitStatusType } from '@shared/types/filesystem'

class GitService {
  async getStatus(worktreePath: string): Promise<GitFileStatus[]> {
    const git = simpleGit(worktreePath)
    const status = await git.status()
    const results: GitFileStatus[] = []

    for (const f of status.modified) {
      results.push({ path: f, status: 'modified', staged: false })
    }
    for (const f of status.not_added) {
      results.push({ path: f, status: 'untracked', staged: false })
    }
    for (const f of status.deleted) {
      results.push({ path: f, status: 'deleted', staged: false })
    }
    for (const f of status.renamed) {
      results.push({ path: (f as unknown as { to: string }).to || String(f), status: 'renamed', staged: false })
    }
    for (const f of status.staged) {
      const existing = results.find((r) => r.path === f)
      if (existing) {
        existing.staged = true
      } else {
        results.push({ path: f, status: 'modified', staged: true })
      }
    }
    for (const f of status.created) {
      const existing = results.find((r) => r.path === f)
      if (existing) {
        existing.status = 'added'
        existing.staged = true
      } else {
        results.push({ path: f, status: 'added', staged: true })
      }
    }

    return results
  }

  async getDiff(worktreePath: string, filePath?: string): Promise<string> {
    const git = simpleGit(worktreePath)
    if (filePath) {
      return git.diff([filePath])
    }
    return git.diff()
  }

  async getBranch(worktreePath: string): Promise<string> {
    const git = simpleGit(worktreePath)
    const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
    return branch.trim()
  }

  async getLog(
    worktreePath: string,
    limit = 20
  ): Promise<Array<{ hash: string; message: string; date: string }>> {
    const git = simpleGit(worktreePath)
    const log = await git.log({ maxCount: limit })
    return log.all.map((entry) => ({
      hash: entry.hash,
      message: entry.message,
      date: entry.date
    }))
  }

  async isGitRepo(worktreePath: string): Promise<boolean> {
    try {
      const git = simpleGit(worktreePath)
      return await git.checkIsRepo()
    } catch {
      return false
    }
  }

  getStatusType(statusCode: string): GitStatusType {
    switch (statusCode) {
      case 'M': return 'modified'
      case 'A': return 'added'
      case 'D': return 'deleted'
      case 'R': return 'renamed'
      case '?': return 'untracked'
      default: return 'clean'
    }
  }
}

export const gitService = new GitService()
