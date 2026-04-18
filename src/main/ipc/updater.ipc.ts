import { IpcMain, BrowserWindow } from 'electron'
import { checkForUpdates } from '../services/AutoUpdater'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('updater:check', () => {
    checkForUpdates()
  })
}
