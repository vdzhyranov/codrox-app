import { ipcMain, BrowserWindow } from 'electron'
import { register as registerWorkspace } from './workspace.ipc'
import { register as registerPty } from './pty.ipc'
import { register as registerFilesystem } from './filesystem.ipc'
import { register as registerGit } from './git.ipc'
import { register as registerAgents } from './agents.ipc'

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  registerWorkspace(ipcMain, mainWindow)
  registerPty(ipcMain, mainWindow)
  registerFilesystem(ipcMain, mainWindow)
  registerGit(ipcMain, mainWindow)
  registerAgents(ipcMain, mainWindow)
}
