import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { Workspace, WorktreeState, SessionData } from '@shared/types'
import { randomUUID } from 'crypto'

class PersistenceService {
  private db: Database.Database

  constructor() {
    const userDataPath = app.getPath('userData')
    const dbPath = join(userDataPath, 'forge.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        last_opened INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `)
  }

  getWorkspaces(): Workspace[] {
    const rows = this.db
      .prepare('SELECT id, path, name, last_opened FROM workspaces ORDER BY last_opened DESC')
      .all() as Array<{ id: string; path: string; name: string; last_opened: number }>
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      name: row.name,
      lastOpened: row.last_opened
    }))
  }

  removeWorkspace(id: string): void {
    this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  }

  saveWorkspace(ws: { path: string; name: string }): Workspace {
    const now = Date.now()
    const existing = this.db
      .prepare('SELECT id FROM workspaces WHERE path = ?')
      .get(ws.path) as { id: string } | undefined

    if (existing) {
      this.db
        .prepare('UPDATE workspaces SET name = ?, last_opened = ? WHERE path = ?')
        .run(ws.name, now, ws.path)
      return {
        id: existing.id,
        path: ws.path,
        name: ws.name,
        lastOpened: now
      }
    }

    const id = randomUUID()
    this.db
      .prepare('INSERT INTO workspaces (id, path, name, last_opened) VALUES (?, ?, ?, ?)')
      .run(id, ws.path, ws.name, now)
    return { id, path: ws.path, name: ws.name, lastOpened: now }
  }

  getAppState<T>(key: string): T | null {
    const row = this.db
      .prepare('SELECT value_json FROM app_state WHERE key = ?')
      .get(key) as { value_json: string } | undefined
    if (!row) return null
    try {
      return JSON.parse(row.value_json) as T
    } catch {
      return null
    }
  }

  setAppState(key: string, value: unknown): void {
    const json = JSON.stringify(value)
    this.db
      .prepare('INSERT INTO app_state (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json')
      .run(key, json)
  }

  saveSession(data: SessionData): void {
    this.setAppState('session', data)
  }

  loadSession(): SessionData | null {
    return this.getAppState<SessionData>('session')
  }

  readWorktreeState(worktreePath: string): WorktreeState | null {
    const statePath = join(worktreePath, '.codrox', 'state.json')
    if (!existsSync(statePath)) return null
    try {
      const raw = readFileSync(statePath, 'utf-8')
      return JSON.parse(raw) as WorktreeState
    } catch {
      return null
    }
  }

  writeWorktreeState(worktreePath: string, state: WorktreeState): void {
    const codroxDir = join(worktreePath, '.codrox')
    if (!existsSync(codroxDir)) {
      mkdirSync(codroxDir, { recursive: true })
    }
    const statePath = join(codroxDir, 'state.json')
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8')
  }
}

export const persistenceService = new PersistenceService()
