import * as watcher from '@parcel/watcher'
import type { AsyncSubscription } from '@parcel/watcher'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

/**
 * Watches a workspace's git metadata dirs for branch/worktree changes.
 * Specifically watches:
 *   <gitCommonDir>/refs/heads/   — branch renames/creates/deletes
 *   <gitCommonDir>/worktrees/    — external worktree add/remove
 *   <gitCommonDir>/HEAD          — HEAD changes (via parent dir watch)
 *
 * Uses @parcel/watcher directly so we can include .git/ paths
 * (FileWatcher explicitly excludes them).
 */
class WorktreeWatcher {
  private subscriptions: Map<string, AsyncSubscription[]> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private onChangeCallback: ((workspaceId: string) => void) | null = null

  setCallback(cb: (workspaceId: string) => void): void {
    this.onChangeCallback = cb
  }

  async watch(workspaceId: string, workspacePath: string): Promise<void> {
    await this.unwatch(workspaceId)

    let gitCommonDir: string
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['rev-parse', '--git-common-dir'],
        { cwd: workspacePath }
      )
      const raw = stdout.trim()
      // May be relative (e.g. ".git") or absolute
      gitCommonDir = raw.startsWith('/') ? raw : join(workspacePath, raw)
    } catch {
      // Not a git repo or git not available — skip
      return
    }

    if (!existsSync(gitCommonDir)) return

    const emit = (): void => {
      const existing = this.debounceTimers.get(workspaceId)
      if (existing) clearTimeout(existing)
      this.debounceTimers.set(
        workspaceId,
        setTimeout(() => {
          this.debounceTimers.delete(workspaceId)
          this.onChangeCallback?.(workspaceId)
        }, 250)
      )
    }

    const subs: AsyncSubscription[] = []

    // Watch the gitCommonDir itself (captures HEAD changes at root)
    // @parcel/watcher watches recursively by default, so this covers
    // refs/heads/** and worktrees/** too. We use a single subscription.
    try {
      const sub = await watcher.subscribe(gitCommonDir, (err, _events) => {
        if (err) return
        emit()
      })
      subs.push(sub)
    } catch {
      // Watcher failed (e.g. permissions) — degrade gracefully
    }

    if (subs.length > 0) {
      this.subscriptions.set(workspaceId, subs)
    }
  }

  async unwatch(workspaceId: string): Promise<void> {
    const subs = this.subscriptions.get(workspaceId)
    if (subs) {
      for (const sub of subs) {
        try {
          await sub.unsubscribe()
        } catch {
          // ignore
        }
      }
      this.subscriptions.delete(workspaceId)
    }
    const timer = this.debounceTimers.get(workspaceId)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(workspaceId)
    }
  }

  async unwatchAll(): Promise<void> {
    for (const id of [...this.subscriptions.keys()]) {
      await this.unwatch(id)
    }
  }
}

export const worktreeWatcher = new WorktreeWatcher()
