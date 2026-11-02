import { CATEGORIES, CATEGORY_IDS, type CategoryId } from '../content/categories'
import type { Experience } from '../content/schema'
import type { Interaction, Settings } from '../store/store'

/**
 * Lightweight, explainable recommendations — no ML.
 *
 * 1. Score each category from explicit interests and past behaviour.
 * 2. Split categories into preferred / related / discovery buckets.
 * 3. Fill the queue by drawing a bucket according to the configured mix
 *    (default 60/25/15), then the best-scoring item inside that bucket.
 */

type Interactions = Record<string, Interaction>

const HOUR = 3_600_000

export function categoryAffinity(pool: Experience[], interactions: Interactions, settings: Settings) {
  const score = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<CategoryId, number>
  for (const c of settings.interests) score[c] += 5
  for (const e of pool) {
    const i = interactions[e.id]
    if (!i) continue
    let s = 0
    if (i.reaction === 1) s += 3
    if (i.reaction === -1) s -= 3
    if (i.savedAt) s += 2
    s += Math.min(i.completions, 3)
    // Swiped away almost immediately: a weak "not now" signal.
    if (i.views > 0 && !i.completions && (i.progress ?? 0) < 0.25) s -= 0.5
    score[e.category] += s
  }
  return score
}

function tagAffinity(pool: Experience[], interactions: Interactions) {
  const tags = new Map<string, number>()
  for (const e of pool) {
    const i = interactions[e.id]
    if (!i) continue
    const w = (i.reaction ?? 0) * 2 + (i.savedAt ? 2 : 0)
    if (!w) continue
    for (const t of e.tags) tags.set(t, (tags.get(t) ?? 0) + w)
  }
  return tags
}

function itemScore(e: Experience, interactions: Interactions, tags: Map<string, number>, now: number) {
  const i = interactions[e.id]
  let s = Math.random() * 2 // a little jitter keeps the feed from feeling scripted
  if (!i || i.views === 0) s += 10
  else {
    s -= Math.min(i.completions, 3) * 3
    if (i.lastSeen && now - i.lastSeen < 24 * HOUR) s -= 6
  }
  const t = e.tags.reduce((sum, tag) => sum + (tags.get(tag) ?? 0), 0)
  s += Math.max(-3, Math.min(3, t * 0.5))
  return s
}

function weightedPick<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0)
  let r = Math.random() * total
  for (const o of options) {
    r -= o.weight
    if (r <= 0) return o.value
  }
  return options[options.length - 1].value
}

export interface QueueOptions {
  topic: CategoryId | 'all'
  /** Put this experience first (deep links, Saved, Explore). */
  startId?: string
  /** Ids to avoid at the start of the queue (recently shown). */
  avoid?: Set<string>
}

export function buildQueue(
  pool: Experience[],
  interactions: Interactions,
  settings: Settings,
  { topic, startId, avoid }: QueueOptions,
): Experience[] {
  const now = Date.now()
  const tags = tagAffinity(pool, interactions)
  const disliked = (e: Experience) => interactions[e.id]?.reaction === -1

  let eligible = pool.filter((e) => (topic === 'all' || e.category === topic) && e.id !== startId)
  // Hide "less like this" items unless that would leave nothing to show.
  if (eligible.some((e) => !disliked(e))) eligible = eligible.filter((e) => !disliked(e))
  if (avoid && eligible.length > avoid.size + 2) eligible = eligible.filter((e) => !avoid.has(e.id))

  const scored = eligible
    .map((e) => ({ e, s: itemScore(e, interactions, tags, now) }))
    .sort((a, b) => b.s - a.s)

  const start = startId ? pool.filter((e) => e.id === startId) : []

  if (topic !== 'all') return [...start, ...scored.map((x) => x.e)]

  const affinity = categoryAffinity(pool, interactions, settings)
  const ranked = [...CATEGORY_IDS].sort((a, b) => affinity[b] - affinity[a])
  const preferred = new Set<CategoryId>([
    ...settings.interests,
    ...ranked.filter((c) => affinity[c] >= 2).slice(0, 3),
  ])
  const related = new Set<CategoryId>()
  for (const c of preferred) for (const r of CATEGORIES[c].related) if (!preferred.has(r)) related.add(r)

  const bucketOf = (c: CategoryId) => (preferred.has(c) ? 'preferred' : related.has(c) ? 'related' : 'discovery')
  const buckets: Record<'preferred' | 'related' | 'discovery', typeof scored> = { preferred: [], related: [], discovery: [] }
  for (const x of scored) buckets[bucketOf(x.e.category)].push(x)

  // Cold start: nothing known yet, so rotate through topics for variety.
  const coldStart = preferred.size === 0

  const out: Experience[] = [...start]
  let lastCat = start[0]?.category
  while (buckets.preferred.length + buckets.related.length + buckets.discovery.length) {
    const nonEmpty = (Object.keys(buckets) as (keyof typeof buckets)[]).filter((k) => buckets[k].length)
    const key = coldStart
      ? 'discovery'
      : weightedPick(nonEmpty.map((k) => ({ value: k, weight: Math.max(1, settings.mix[k]) })))
    const list = buckets[key].length ? buckets[key] : buckets[nonEmpty[0]]
    // Avoid two in a row from the same category when there's an alternative.
    let idx = list.findIndex((x) => x.e.category !== lastCat)
    if (idx < 0) idx = 0
    const [pick] = list.splice(idx, 1)
    out.push(pick.e)
    lastCat = pick.e.category
  }
  return out
}
