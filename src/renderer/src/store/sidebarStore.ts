import { create } from 'zustand'

type SidebarView = 'explorer' | 'agents' | 'settings' | 'extensions'

interface SidebarStore {
  activeView: SidebarView
  setActiveView: (view: SidebarView) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  activeView: 'explorer',
  setActiveView: (view) => set({ activeView: view }),
}))
