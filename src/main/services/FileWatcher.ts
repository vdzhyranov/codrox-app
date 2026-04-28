import * as watcher from '@parcel/watcher'
import type { AsyncSubscription } from '@parcel/watcher'
import type { FileChangeEvent } from '@shared/types/filesystem'

type Listener = (worktreeId: string, events: FileChangeEvent[]) => void

class FileWatcher {
  private watchers: Map<string, AsyncSubscription> = new Map()
  private listeners: Set<Listener> = new Set()
  private legacyCallback: Listener | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private pendingEvents: Map<string, FileChangeEvent[]> = new Map()

  /** Legacy single-callback API: replaces (not appends) the previous callback. */
  setCallback(cb: Listener): void {
    if (this.legacyCallback) this.listeners.delete(this.legacyCallback)
    this.legacyCallback = cb
    this.listeners.add(cb)
  }

  /** Add a listener; returns an unsubscribe fn. */
  addListener(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit(worktreeId: string, events: FileChangeEvent[]): void {
    for (const cb of this.listeners) {
      try {
        cb(worktreeId, events)
      } catch {
        // a listener throwing should not break others
      }
    }
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
              !rel.includes('/.codrox/') &&
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
              this.emit(worktreeId, batch)
            }
          }, 100)
        )
      },
      {
        ignore: ['.git', 'node_modules', '.codrox', '.DS_Store']
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
