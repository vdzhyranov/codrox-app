import { IpcMain, BrowserWindow, app } from 'electron'
import { net } from 'electron'

interface VersionInfo {
  current: string
  latest: string | null
  updateAvailable: boolean
}

function fetchLatestRelease(): Promise<string | null> {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: 'https://api.github.com/repos/vdzhyranov/codrox-app/releases/latest',
    })

    request.setHeader('Accept', 'application/vnd.github.v3+json')
    request.setHeader('User-Agent', 'Codrox')

    let body = ''

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        resolve(null)
        return
      }
      response.on('data', (chunk) => {
        body += chunk.toString()
      })
      response.on('end', () => {
        try {
          const data = JSON.parse(body)
          const tag = data.tag_name as string
          // Strip leading 'v' if present
          resolve(tag.startsWith('v') ? tag.slice(1) : tag)
        } catch {
          resolve(null)
        }
      })
    })

    request.on('error', () => resolve(null))
    request.end()
  })
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0
    const lv = l[i] ?? 0
    if (lv > cv) return true
    if (lv < cv) return false
  }
  return false
}

let lastCheck = 0
const CHECK_INTERVAL = 30 * 60 * 1000 // 30 minutes

async function getVersionInfo(): Promise<VersionInfo> {
  const current = app.getVersion()
  const latest = await fetchLatestRelease()
  lastCheck = Date.now()
  return {
    current,
    latest,
    updateAvailable: latest ? compareVersions(current, latest) : false,
  }
}

export function register(ipcMain: IpcMain, mainWindow: BrowserWindow): void {
  ipcMain.handle('version:check', async (): Promise<VersionInfo> => {
    return getVersionInfo()
  })

  // Re-check on window focus (throttled to 30 min)
  app.on('browser-window-focus', () => {
    if (Date.now() - lastCheck < CHECK_INTERVAL) return
    getVersionInfo().then((info) => {
      if (info.updateAvailable && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('version:update', info)
      }
    })
  })
}
