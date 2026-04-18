import { IpcMain, BrowserWindow } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate } from '../services/AutoUpdater'

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('updater:check', () => {
    checkForUpdates()
  })

  ipcMain.handle('updater:download', () => {
    downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })
}
