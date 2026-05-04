import type { IpcMain, BrowserWindow } from 'electron'
import { persistenceService } from '../services/PersistenceService'
import { DEFAULT_SETTINGS } from '@shared/types/settings'
import type { AppSettings } from '@shared/types/settings'

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  ipcMain.handle('settings:load', () => {
    return persistenceService.getAppState<AppSettings>('settings') ?? DEFAULT_SETTINGS
  })

  ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
    persistenceService.setAppState('settings', settings)
    return { success: true }
  })

  ipcMain.handle('settings:setZoom', (_event, payload: { level: number }) => {
    const clamped = Math.max(-2, Math.min(3, payload.level))
    mainWindow.webContents.setZoomLevel(clamped)
    return { zoomLevel: clamped }
  })
}
