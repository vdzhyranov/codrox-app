export interface ThemeColors {
  bg: string
  surface: string
  surface2: string
  surface3: string
  border: string
  border2: string
  accent: string
  accent2: string
  accentDim: string
  text: string
  text2: string
  text3: string
}

export interface ThemeDefinition {
  id: string
  name: string
  colors: ThemeColors
}

export interface AppSettings {
  theme: string
  fontSize: number   // actual px value (11–18)
  zoomLevel: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'midnight',
  fontSize: 13,
  zoomLevel: 0,
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bg: '#0a0a0b',
      surface: '#111113',
      surface2: '#18181c',
      surface3: '#1f1f25',
      border: '#2a2a32',
      border2: '#353540',
      accent: '#7c6af7',
      accent2: '#a78bfa',
      accentDim: 'rgba(124, 106, 247, 0.13)',
      text: '#f0f0f8',
      text2: '#a8a8be',
      text3: '#6e6e85',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      bg: '#080c12',
      surface: '#0d1219',
      surface2: '#131a23',
      surface3: '#1a222e',
      border: '#243040',
      border2: '#2e3c50',
      accent: '#3b82f6',
      accent2: '#60a5fa',
      accentDim: 'rgba(59, 130, 246, 0.13)',
      text: '#e4eaf4',
      text2: '#8898b4',
      text3: '#566882',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      bg: '#060b08',
      surface: '#0c130e',
      surface2: '#121b15',
      surface3: '#19231c',
      border: '#243830',
      border2: '#2e4438',
      accent: '#22c55e',
      accent2: '#4ade80',
      accentDim: 'rgba(34, 197, 94, 0.13)',
      text: '#e4f0e8',
      text2: '#88b098',
      text3: '#567864',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    colors: {
      bg: '#0c0906',
      surface: '#13100c',
      surface2: '#1c1712',
      surface3: '#261f18',
      border: '#3a3028',
      border2: '#463a30',
      accent: '#f59e0b',
      accent2: '#fbbf24',
      accentDim: 'rgba(245, 158, 11, 0.13)',
      text: '#f0ece4',
      text2: '#b0a898',
      text3: '#78705c',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: {
      bg: '#0c080a',
      surface: '#130e10',
      surface2: '#1c1418',
      surface3: '#261c20',
      border: '#3a2830',
      border2: '#463238',
      accent: '#f472b6',
      accent2: '#f9a8d4',
      accentDim: 'rgba(244, 114, 182, 0.13)',
      text: '#f0e8ec',
      text2: '#b098a8',
      text3: '#786470',
    },
  },
]
