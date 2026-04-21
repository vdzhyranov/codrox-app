import { create } from 'zustand'
import { THEMES, DEFAULT_SETTINGS } from '@shared/types/settings'
import type { AppSettings, ThemeDefinition } from '@shared/types/settings'

function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement
  const { colors } = theme
  root.style.setProperty('--bg', colors.bg)
  root.style.setProperty('--surface', colors.surface)
  root.style.setProperty('--surface2', colors.surface2)
  root.style.setProperty('--surface3', colors.surface3)
  root.style.setProperty('--border', colors.border)
  root.style.setProperty('--border2', colors.border2)
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--accent2', colors.accent2)
  root.style.setProperty('--accent-dim', colors.accentDim)
  root.style.setProperty('--text', colors.text)
  root.style.setProperty('--text2', colors.text2)
  root.style.setProperty('--text3', colors.text3)
}

function applyFontSize(px: number): void {
  document.documentElement.style.setProperty('--ui-font-size', `${px}px`)
}

function persist(settings: AppSettings): void {
  window.api.invoke('settings:save', settings).catch(() => {})
}

interface SettingsStore {
  theme: string
  fontSize: number
  zoomLevel: number
  loaded: boolean
  load: () => Promise<void>
  setTheme: (themeId: string) => void
  setFontSize: (px: number) => void
  setZoomLevel: (level: number) => void
  syncZoomFromMain: (level: number) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  theme: DEFAULT_SETTINGS.theme,
  fontSize: DEFAULT_SETTINGS.fontSize,
  zoomLevel: DEFAULT_SETTINGS.zoomLevel,
  loaded: false,

  load: async () => {
    try {
      const saved = (await window.api.invoke('settings:load', undefined)) as AppSettings | null
      const settings = { ...DEFAULT_SETTINGS, ...saved }
      const theme = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0]
      applyTheme(theme)
      applyFontSize(settings.fontSize)
      set({ theme: settings.theme, fontSize: settings.fontSize, zoomLevel: settings.zoomLevel, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setTheme: (themeId: string) => {
    const theme = THEMES.find((t) => t.id === themeId)
    if (!theme) return
    applyTheme(theme)
    set({ theme: themeId })
    const s = get()
    persist({ theme: themeId, fontSize: s.fontSize, zoomLevel: s.zoomLevel })
  },

  setFontSize: (px: number) => {
    const clamped = Math.max(11, Math.min(18, px))
    applyFontSize(clamped)
    set({ fontSize: clamped })
    const s = get()
    persist({ theme: s.theme, fontSize: clamped, zoomLevel: s.zoomLevel })
  },

  setZoomLevel: (level: number) => {
    const clamped = Math.max(-2, Math.min(3, Math.round(level * 2) / 2))
    window.api.invoke('settings:setZoom', { level: clamped }).catch(() => {})
    set({ zoomLevel: clamped })
    const s = get()
    persist({ theme: s.theme, fontSize: s.fontSize, zoomLevel: clamped })
  },

  syncZoomFromMain: (level: number) => {
    set({ zoomLevel: level })
    const s = get()
    persist({ theme: s.theme, fontSize: s.fontSize, zoomLevel: level })
  },
}))
