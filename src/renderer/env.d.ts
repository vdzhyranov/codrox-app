/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface Window {
  api: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(channel: string, callback: (...args: unknown[]) => void): () => void
    send(channel: string, ...args: unknown[]): void
  }
}
