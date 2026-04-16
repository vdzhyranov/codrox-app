import { ipcMain, BrowserWindow } from 'electron'
import { register as registerWorkspace } from './workspace.ipc'
import { register as registerPty } from './pty.ipc'
import { register as registerFilesystem } from './filesystem.ipc'
import { register as registerGit } from './git.ipc'
import { register as registerSubAgents } from './subagents.ipc'
let registered = false

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  if (registered) return
  registered = true
  registerWorkspace(ipcMain, mainWindow)
  registerPty(ipcMain, mainWindow)
  registerFilesystem(ipcMain, mainWindow)
  registerGit(ipcMain, mainWindow)
  registerSubAgents(ipcMain, mainWindow)
}
