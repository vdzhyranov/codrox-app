import * as watcher from '@parcel/watcher'
import type { AsyncSubscription } from '@parcel/watcher'
import type { FileChangeEvent } from '@shared/types/filesystem'

class FileWatcher {
  private watchers: Map<string, AsyncSubscription> = new Map()
  private onChangeCallback: ((worktreeId: string, events: FileChangeEvent[]) => void) | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private pendingEvents: Map<string, FileChangeEvent[]> = new Map()

  setCallback(cb: (worktreeId: string, events: FileChangeEvent[]) => void): void {
    this.onChangeCallback = cb
  }

  async watch(worktreeId: string, dirPath: string): Promise<void> {
    await this.unwatch(worktreeId)

    const subscription = await watcher.subscribe(
      dirPath,
      (err, events) => {
        if (err) return

        const mapped: FileChangeEvent[] = events
          .filter((e) => {
            const rel = e.path.replace(dirPath, '')
            return (
              !rel.includes('/.git/') &&
              !rel.includes('/node_modules/') &&
              !rel.includes('/.forge/') &&
              !rel.includes('.DS_Store')
            )
          })
          .map((e) => ({
            type: e.type === 'create' ? 'create' : e.type === 'delete' ? 'delete' : 'update',
            path: e.path
          }))

        if (mapped.length === 0) return

        const pending = this.pendingEvents.get(worktreeId) || []
        pending.push(...mapped)
        this.pendingEvents.set(worktreeId, pending)

        const existing = this.debounceTimers.get(worktreeId)
        if (existing) clearTimeout(existing)

        this.debounceTimers.set(
          worktreeId,
          setTimeout(() => {
            const batch = this.pendingEvents.get(worktreeId) || []
            this.pendingEvents.delete(worktreeId)
            this.debounceTimers.delete(worktreeId)
            if (batch.length > 0) {
              this.onChangeCallback?.(worktreeId, batch)
            }
          }, 100)
        )
      },
      {
        ignore: ['.git', 'node_modules', '.forge', '.DS_Store']
      }
    )

    this.watchers.set(worktreeId, subscription)
  }

  async unwatch(worktreeId: string): Promise<void> {
    const sub = this.watchers.get(worktreeId)
    if (sub) {
      await sub.unsubscribe()
      this.watchers.delete(worktreeId)
    }
    const timer = this.debounceTimers.get(worktreeId)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(worktreeId)
    }
    this.pendingEvents.delete(worktreeId)
  }

  async unwatchAll(): Promise<void> {
    for (const id of this.watchers.keys()) {
      await this.unwatch(id)
    }
  }
}

export const fileWatcher = new FileWatcher()
