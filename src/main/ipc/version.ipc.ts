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

export function register(ipcMain: IpcMain, _mainWindow: BrowserWindow): void {
  ipcMain.handle('version:check', async (): Promise<VersionInfo> => {
    const current = app.getVersion()
    const latest = await fetchLatestRelease()
    return {
      current,
      latest,
      updateAvailable: latest ? compareVersions(current, latest) : false,
    }
  })
}
