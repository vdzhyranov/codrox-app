import { ipcMain, BrowserWindow } from 'electron'
import { register as registerWorkspace } from './workspace.ipc'
import { register as registerPty } from './pty.ipc'
import { register as registerFilesystem } from './filesystem.ipc'
import { register as registerGit } from './git.ipc'
import { register as registerSubAgents } from './subagents.ipc'
import { register as registerLinear } from './linear.ipc'
import { register as registerBrowser } from './browser.ipc'
import { register as registerSettings } from './settings.ipc'
import { register as registerVersion } from './version.ipc'
import { register as registerGraph } from './graph.ipc'
import { register as registerTokens } from './tokens.ipc'
let registered = false

export function registerAllHandlers(mainWindow: BrowserWindow): void {
  if (registered) return
  registered = true
  registerWorkspace(ipcMain, mainWindow)
  registerPty(ipcMain, mainWindow)
  registerFilesystem(ipcMain, mainWindow)
  registerGit(ipcMain, mainWindow)
  registerSubAgents(ipcMain, mainWindow)
  registerLinear(ipcMain, mainWindow)
  registerBrowser(ipcMain, mainWindow)
  registerSettings(ipcMain, mainWindow)
  registerVersion(ipcMain, mainWindow)
  registerGraph(ipcMain, mainWindow)
  registerTokens(ipcMain)
}
