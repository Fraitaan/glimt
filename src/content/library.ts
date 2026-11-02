import { useMemo } from 'react'
import { experienceSchema, type Experience } from './schema'
import { useAppState, type Lang } from '../store/store'

/**
 * The curated library: every JSON file in /content/experiences is bundled at build time.
 * Adding content = dropping a file there and rebuilding.
 */
const modules = import.meta.glob('../../content/experiences/*.json', { eager: true, import: 'default' })

export const curated: Experience[] = Object.entries(modules).flatMap(([path, raw]) => {
  const parsed = experienceSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`Skipping invalid content ${path}`, parsed.error.issues)
    return []
  }
  return [parsed.data]
})

/** Translations share a group so the feed shows one version per language. */
export const groupId = (e: Experience) => e.translationOf ?? e.id

export function resolveLanguage(all: Experience[], lang: Lang, otherLanguages: boolean): Experience[] {
  const groups = new Map<string, Experience[]>()
  for (const e of all) {
    const g = groups.get(groupId(e)) ?? []
    g.push(e)
    groups.set(groupId(e), g)
  }
  const out: Experience[] = []
  for (const variants of groups.values()) {
    const pick =
      variants.find((v) => v.language === lang) ??
      (otherLanguages ? variants.find((v) => v.language === 'en') ?? variants[0] : undefined)
    if (pick) out.push(pick)
  }
  return out
}

/** Every experience visible to the user, in their language. */
export function useLibrary() {
  const custom = useAppState((s) => s.custom)
  const lang = useAppState((s) => s.settings.language)
  const other = useAppState((s) => s.settings.otherLanguages)
  return useMemo(() => {
    const ids = new Set(custom.map((c) => c.id))
    const all = [...curated.filter((c) => !ids.has(c.id)), ...custom]
    return resolveLanguage(all, lang, other)
  }, [custom, lang, other])
}

/** Lookup by id across all languages (used for saved items and deep links). */
export function useExperienceIndex() {
  const custom = useAppState((s) => s.custom)
  return useMemo(() => {
    const map = new Map<string, Experience>()
    for (const e of [...curated, ...custom]) map.set(e.id, e)
    return map
  }, [custom])
}
