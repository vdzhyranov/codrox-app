import { create } from 'zustand'
import type { WorkspaceSettings } from '@shared/types'
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/types'

interface WorkspaceSettingsStore {
  settingsByWorkspace: Record<string, WorkspaceSettings>
  loadSettings: (workspaceId: string) => Promise<WorkspaceSettings>
  saveSettings: (workspaceId: string, settings: WorkspaceSettings) => Promise<void>
  getSettings: (workspaceId: string) => WorkspaceSettings
}

export const useWorkspaceSettingsStore = create<WorkspaceSettingsStore>((set, get) => ({
  settingsByWorkspace: {},

  getSettings: (workspaceId: string) => {
    return get().settingsByWorkspace[workspaceId] ?? DEFAULT_WORKSPACE_SETTINGS
  },

  loadSettings: async (workspaceId: string) => {
    const settings = (await window.api.invoke('workspace:getSettings', { workspaceId })) as WorkspaceSettings
    set((state) => ({
      settingsByWorkspace: { ...state.settingsByWorkspace, [workspaceId]: settings }
    }))
    return settings
  },

  saveSettings: async (workspaceId: string, settings: WorkspaceSettings) => {
    await window.api.invoke('workspace:saveSettings', { workspaceId, settings })
    set((state) => ({
      settingsByWorkspace: { ...state.settingsByWorkspace, [workspaceId]: settings }
    }))
  },
}))
