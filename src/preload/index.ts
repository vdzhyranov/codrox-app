import { contextBridge, ipcRenderer, clipboard } from 'electron'

const api = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, ...args)
  },

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },

  send(channel: string, ...args: unknown[]): void {
    ipcRenderer.send(channel, ...args)
  },

  clipboardWriteText(text: string): void {
    clipboard.writeText(text)
  },

  clipboardReadText(): string {
    return clipboard.readText()
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
