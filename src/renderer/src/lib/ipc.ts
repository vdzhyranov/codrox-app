import type {
  IpcChannel,
  IpcEventChannel,
  IpcRequest,
  IpcResponse,
  IpcEventPayload
} from '@shared/types'

export const ipc = {
  invoke<C extends IpcChannel>(
    channel: C,
    payload: IpcRequest<C>
  ): Promise<IpcResponse<C>> {
    return window.api.invoke(channel, payload) as Promise<IpcResponse<C>>
  },

  on<C extends IpcEventChannel>(
    channel: C,
    callback: (payload: IpcEventPayload<C>) => void
  ): () => void {
    return window.api.on(channel, callback as (...args: unknown[]) => void)
  }
}
