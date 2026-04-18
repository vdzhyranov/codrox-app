import { app, BrowserWindow } from 'electron'
import https from 'https'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'error'; message: string }

let mainWindow: BrowserWindow | null = null

function send(status: UpdateStatus): void {
  mainWindow?.webContents.send('updater:status', status)
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number)
  const l = local.split('.').map(Number)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Check for updates 3 seconds after launch, then every 4 hours
  setTimeout(() => checkForUpdates(), 3000)
  setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)
}

export function checkForUpdates(): void {
  send({ state: 'checking' })

  const options = {
    hostname: 'api.github.com',
    path: '/repos/vdzhyranov/codrox-app/releases/latest',
    headers: {
      'Authorization': 'token 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',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Codrox',
    },
  }

  https
    .get(options, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        try {
          const release = JSON.parse(body)
          const latest = release.tag_name?.replace(/^v/, '')
          const current = app.getVersion()
          if (latest && isNewer(latest, current)) {
            send({ state: 'available', version: latest })
          } else {
            send({ state: 'not-available' })
          }
        } catch {
          send({ state: 'not-available' })
        }
      })
    })
    .on('error', () => {
      send({ state: 'not-available' })
    })
}
