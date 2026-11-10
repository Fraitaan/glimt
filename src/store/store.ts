import { useSyncExternalStore } from 'react'
import type { CategoryId } from '../content/categories'
import { experienceSchema, type Experience } from '../content/schema'

/**
 * All personal data lives in one localStorage entry. No accounts, no backend.
 * Export/import moves it between devices.
 */

export type Lang = 'en' | 'sv'
export type AnimationLevel = 'auto' | 'full' | 'reduced' | 'minimal'

export interface Mix {
  preferred: number
  related: number
  discovery: number
}

export interface Settings {
  language: Lang
  /** Show content in other languages when there's no version in yours. */
  otherLanguages: boolean
  narration: boolean
  narrationRate: number
  voiceURI?: string
  animation: AnimationLevel
  interests: CategoryId[]
  mix: Mix
  autoAdvance: boolean
}

export interface Interaction {
  views: number
  completions: number
  /** 1 = liked, -1 = less like this */
  reaction?: 1 | -1
  savedAt?: number
  lastSeen?: number
  /** Furthest point reached, 0–1. */
  progress?: number
}

export interface AppState {
  version: 1
  settings: Settings
  interactions: Record<string, Interaction>
  /** Experiences added on this device (pasted JSON or file import). */
  custom: Experience[]
  hints: string[]
}

const KEY = 'smart-learning:v1'

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  otherLanguages: false,
  narration: false,
  narrationRate: 1,
  animation: 'auto',
  interests: [],
  mix: { preferred: 60, related: 25, discovery: 15 },
  autoAdvance: true,
}

function initial(): AppState {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, interactions: {}, custom: [], hints: [] }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial()
    return normalize(JSON.parse(raw))
  } catch {
    return initial()
  }
}

/** Accepts stored or imported data and fills any gaps with defaults. */
function normalize(data: Partial<AppState>): AppState {
  const base = initial()
  const custom = Array.isArray(data.custom)
    ? data.custom.flatMap((c) => {
        const r = experienceSchema.safeParse(c)
        return r.success ? [r.data] : []
      })
    : []
  return {
    version: 1,
    // The app is English-only for now, so older saved Swedish settings are reset.
    settings: { ...base.settings, ...data.settings, language: 'en', otherLanguages: false, mix: { ...base.settings.mix, ...data.settings?.mix } },
    interactions: data.interactions && typeof data.interactions === 'object' ? data.interactions : {},
    custom,
    hints: Array.isArray(data.hints) ? data.hints : [],
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private mode or quota exceeded: keep working in memory.
  }
}

export function getState() {
  return state
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state)
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

export const useSettings = () => useAppState((s) => s.settings)

// ---- actions ---------------------------------------------------------------

function patchInteraction(id: string, patch: (i: Interaction) => Interaction) {
  setState((s) => {
    const prev = s.interactions[id] ?? { views: 0, completions: 0 }
    return { ...s, interactions: { ...s.interactions, [id]: patch(prev) } }
  })
}

export const actions = {
  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },
  recordView(id: string) {
    patchInteraction(id, (i) => ({ ...i, views: i.views + 1, lastSeen: Date.now() }))
  },
  recordProgress(id: string, progress: number) {
    patchInteraction(id, (i) => ({ ...i, progress: Math.max(i.progress ?? 0, progress) }))
  },
  recordCompletion(id: string) {
    patchInteraction(id, (i) => ({ ...i, completions: i.completions + 1, progress: 1 }))
  },
  react(id: string, reaction: 1 | -1) {
    patchInteraction(id, (i) => ({ ...i, reaction: i.reaction === reaction ? undefined : reaction }))
  },
  toggleSave(id: string) {
    patchInteraction(id, (i) => ({ ...i, savedAt: i.savedAt ? undefined : Date.now() }))
  },
  toggleInterest(cat: CategoryId) {
    setState((s) => {
      const has = s.settings.interests.includes(cat)
      const interests = has ? s.settings.interests.filter((c) => c !== cat) : [...s.settings.interests, cat]
      return { ...s, settings: { ...s.settings, interests } }
    })
  },
  addCustom(exp: Experience) {
    setState((s) => ({ ...s, custom: [...s.custom.filter((c) => c.id !== exp.id), exp] }))
  },
  removeCustom(id: string) {
    setState((s) => ({ ...s, custom: s.custom.filter((c) => c.id !== id) }))
  },
  markHint(hint: string) {
    setState((s) => (s.hints.includes(hint) ? s : { ...s, hints: [...s.hints, hint] }))
  },
  /** Clears views and progress but keeps likes, saves, settings and custom content. */
  resetHistory() {
    setState((s) => {
      const interactions: Record<string, Interaction> = {}
      for (const [id, i] of Object.entries(s.interactions)) {
        if (i.reaction || i.savedAt) interactions[id] = { views: 0, completions: 0, reaction: i.reaction, savedAt: i.savedAt }
      }
      return { ...s, interactions }
    })
  },
  resetEverything() {
    setState(() => initial())
  },
  exportData(): string {
    return JSON.stringify({ app: 'smart-learning', exportedAt: new Date().toISOString(), ...state }, null, 2)
  },
  importData(json: string) {
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object' || !('settings' in data)) throw new Error('Not a Smart Learning export')
    setState(() => normalize(data))
  },
}
