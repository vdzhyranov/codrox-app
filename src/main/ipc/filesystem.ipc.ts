import { IpcMain, BrowserWindow } from 'electron'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { join, basename, relative } from 'path'
import { fileWatcher } from '../services/FileWatcher'
import { gitService } from '../services/GitService'
import type { FileTreeNode } from '@shared/types/filesystem'
import type { GitFileStatus } from '@shared/types/git'

const IGNORED = new Set(['.git', 'node_modules', '.codrox', '.DS_Store', '.Trash', 'dist', 'out'])
const MAX_DEPTH = 10

async function buildFileTree(
  dirPath: string,
  gitStatusMap: Map<string, string>,
  depth = 0
): Promise<FileTreeNode> {
  const name = basename(dirPath)
  const node: FileTreeNode = { name, path: dirPath, type: 'directory', children: [] }

  if (depth >= MAX_DEPTH) return node

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return node
  }

  const children: FileTreeNode[] = []

  for (const entry of entries.sort()) {
    if (IGNORED.has(entry)) continue

    const fullPath = join(dirPath, entry)
    let stats
    try {
      stats = await stat(fullPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      const child = await buildFileTree(fullPath, gitStatusMap, depth + 1)
      children.push(child)
    } else {
      const gitStatus = gitStatusMap.get(fullPath) || undefined
      children.push({
        name: entry,
        path: fullPath,
        type: 'file',
        gitStatus: gitStatus as FileTreeNode['gitStatus']
      })
    }
  }

  node.children = children
  return node
}

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  fileWatcher.setCallback((worktreeId, events) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fs:changed', { worktreeId, events })
    }
  })

  ipcMain.handle('fs:readDir', async (_event, payload: { path: string; depth?: number }) => {
    const gitStatusMap = new Map<string, string>()

    try {
      const isRepo = await gitService.isGitRepo(payload.path)
      if (isRepo) {
        const statuses: GitFileStatus[] = await gitService.getStatus(payload.path)
        for (const s of statuses) {
          gitStatusMap.set(join(payload.path, s.path), s.status)
        }
      }
    } catch {
      // Not a git repo or git not available — continue without status
    }

    return buildFileTree(payload.path, gitStatusMap, 0)
  })

  ipcMain.handle('fs:search', async (_event, payload: { rootPath: string; query: string; limit?: number }) => {
    const results: { name: string; path: string; relativePath: string }[] = []
    const limit = payload.limit ?? 50
    const query = payload.query.toLowerCase()

    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > MAX_DEPTH || results.length >= limit) return
      let entries: string[]
      try {
        entries = await readdir(dir)
      } catch {
        return
      }
      for (const entry of entries) {
        if (results.length >= limit) return
        if (IGNORED.has(entry)) continue
        const fullPath = join(dir, entry)
        let stats
        try {
          stats = await stat(fullPath)
        } catch {
          continue
        }
        if (entry.toLowerCase().includes(query)) {
          results.push({
            name: entry,
            path: fullPath,
            relativePath: relative(payload.rootPath, fullPath),
          })
        }
        if (stats.isDirectory()) {
          await walk(fullPath, depth + 1)
        }
      }
    }

    await walk(payload.rootPath, 0)
    return results
  })

  ipcMain.handle('fs:searchContent', async (_event, payload: { rootPath: string; query: string; limit?: number }) => {
    const limit = payload.limit ?? 30
    const results: { name: string; path: string; relativePath: string; line: number; lineContent: string }[] = []

    async function walk(dir: string, depth: number): Promise<void> {
      if (depth > MAX_DEPTH || results.length >= limit) return
      let entries: string[]
      try {
        entries = await readdir(dir)
      } catch {
        return
      }
      for (const entry of entries) {
        if (results.length >= limit) return
        if (IGNORED.has(entry)) continue
        const fullPath = join(dir, entry)
        let stats
        try {
          stats = await stat(fullPath)
        } catch {
          continue
        }
        if (stats.isDirectory()) {
          await walk(fullPath, depth + 1)
        } else if (stats.isFile() && stats.size < 512 * 1024) {
          // Only search text files under 512KB
          try {
            const content = await readFile(fullPath, 'utf-8')
            const queryLower = payload.query.toLowerCase()
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= limit) return
              if (lines[i].toLowerCase().includes(queryLower)) {
                results.push({
                  name: entry,
                  path: fullPath,
                  relativePath: relative(payload.rootPath, fullPath),
                  line: i + 1,
                  lineContent: lines[i].trim().slice(0, 120),
                })
              }
            }
          } catch {
            // Binary file or read error — skip
          }
        }
      }
    }

    await walk(payload.rootPath, 0)
    return results
  })

  ipcMain.handle('fs:readFile', async (_event, payload: { path: string }) => {
    const content = await readFile(payload.path, 'utf-8')
    return { content }
  })

  ipcMain.handle('fs:writeFile', async (_event, payload: { path: string; content: string }) => {
    await writeFile(payload.path, payload.content, 'utf-8')
    return { success: true }
  })

  ipcMain.handle('fs:watch', async (_event, payload: { worktreeId: string; path: string }) => {
    await fileWatcher.watch(payload.worktreeId, payload.path)
  })

  ipcMain.handle('fs:unwatch', async (_event, payload: { worktreeId: string }) => {
    await fileWatcher.unwatch(payload.worktreeId)
  })
}
