import { ElectronAPI } from '@electron-toolkit/preload'

interface ForgeAPI {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, callback: (...args: unknown[]) => void): () => void
  send(channel: string, ...args: unknown[]): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ForgeAPI
  }
}
