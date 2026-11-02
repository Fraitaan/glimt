import { createContext, useContext, useSyncExternalStore } from 'react'
import type { AnimationLevel } from '../store/store'

export type MotionLevel = 'full' | 'reduced' | 'minimal'

const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

function subscribe(cb: () => void) {
  query?.addEventListener('change', cb)
  return () => query?.removeEventListener('change', cb)
}

/** Resolves the user's animation setting against the OS "reduce motion" preference. */
export function useResolvedMotion(setting: AnimationLevel): MotionLevel {
  const osReduce = useSyncExternalStore(subscribe, () => !!query?.matches)
  if (setting === 'auto') return osReduce ? 'reduced' : 'full'
  return setting
}

export const MotionLevelContext = createContext<MotionLevel>('full')
export const useMotionLevel = () => useContext(MotionLevelContext)
