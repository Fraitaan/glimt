import { z } from 'zod'
import { CATEGORY_IDS } from './categories'
import { ILLUSTRATION_KEYS } from './illustrationKeys'

/**
 * Content schema. Every learning experience — curated, generated or pasted in —
 * is validated against this before it can appear in the feed.
 */

const role = z.enum(['hook', 'context', 'explanation', 'example', 'fact', 'insight', 'takeaway'])

const base = {
  role,
  /** Main on-screen text. Also narrated. */
  text: z.string().min(2).max(220),
  /** Seconds the scene stays on screen (narration may extend it). */
  duration: z.number().min(3).max(30),
  /** Words or short phrases in `text` to highlight with the accent color. */
  emphasis: z.array(z.string()).optional(),
  /** Optional replacement for what the narrator says. */
  narration: z.string().optional(),
}

const illustration = z.enum(ILLUSTRATION_KEYS)

export const sceneSchema = z.discriminatedUnion('template', [
  // 1. Big animated typography
  z.object({ ...base, template: z.literal('kinetic') }),
  // 2. Illustrated explanation
  z.object({ ...base, template: z.literal('illustration'), visual: illustration }),
  // 3. Before/after or this-vs-that
  z.object({
    ...base,
    template: z.literal('comparison'),
    left: z.object({ label: z.string().max(30), text: z.string().max(90) }),
    right: z.object({ label: z.string().max(30), text: z.string().max(90) }),
  }),
  // 4. Timeline
  z.object({
    ...base,
    template: z.literal('timeline'),
    events: z.array(z.object({ when: z.string().max(20), what: z.string().max(80) })).min(2).max(5),
  }),
  // 5. Animated statistic
  z.object({
    ...base,
    template: z.literal('stat'),
    value: z.number(),
    decimals: z.number().int().min(0).max(3).optional(),
    prefix: z.string().max(6).optional(),
    suffix: z.string().max(12).optional(),
  }),
  // 6. Concept breakdown
  z.object({
    ...base,
    template: z.literal('breakdown'),
    items: z.array(z.object({ title: z.string().max(40), detail: z.string().max(90).optional() })).min(2).max(4),
  }),
  // 7. Question and answer (answer revealed mid-scene)
  z.object({ ...base, template: z.literal('question'), answer: z.string().max(160) }),
  // 8. Surprising fact reveal
  z.object({
    ...base,
    template: z.literal('reveal'),
    reveal: z.string().max(120),
    visual: illustration.optional(),
  }),
])

export const sourceSchema = z.object({
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: z.string().url(),
  year: z.number().int().min(-500).max(2100).optional(),
})

export const EVIDENCE_LEVELS = ['established', 'supported', 'debated', 'historical', 'concept', 'simplified'] as const

export const experienceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase letters, digits and dashes'),
  title: z.string().min(3).max(80),
  category: z.enum(CATEGORY_IDS),
  language: z.enum(['en', 'sv']),
  /** id of the experience this one translates — lets the feed show one version per language. */
  translationOf: z.string().optional(),
  /** One or two sentences used in lists and read mode. */
  summary: z.string().min(10).max(300),
  /** How sure we are: drives the evidence badge. */
  evidence: z.enum(EVIDENCE_LEVELS),
  /** Short caveat shown with the sources, e.g. what is debated. */
  evidenceNote: z.string().max(400).optional(),
  /** Optional; computed from scenes when omitted. */
  duration: z.number().optional(),
  scenes: z.array(sceneSchema).min(3).max(9),
  sources: z.array(sourceSchema).min(1),
  tags: z.array(z.string()).default([]),
  /** Where it came from — purely informational. */
  origin: z.enum(['curated', 'generated', 'manual']).default('curated'),
})

export type Scene = z.infer<typeof sceneSchema>
export type Source = z.infer<typeof sourceSchema>
export type Evidence = (typeof EVIDENCE_LEVELS)[number]
export type Experience = z.infer<typeof experienceSchema>
export type ExperienceInput = z.input<typeof experienceSchema>

/** Seconds needed to comfortably read everything a scene puts on screen. */
export function readingTime(s: Scene) {
  const words = s.text.split(/\s+/).length + extraWords(s)
  return words / 3 + 1.5 // ~3 words/second plus time for the animation to settle
}

/** The duration the player actually uses: never shorter than the reading time. */
export function sceneDuration(s: Scene) {
  return Math.max(s.duration, Math.ceil(readingTime(s)))
}

export function totalDuration(e: Experience) {
  return e.scenes.reduce((sum, s) => sum + sceneDuration(s), 0)
}

/** Soft checks that don't make content invalid but are worth a warning. */
export function lintExperience(e: Experience): string[] {
  const warnings: string[] = []
  e.scenes.forEach((s, i) => {
    const needed = readingTime(s)
    if (s.duration + 3 < needed) warnings.push(`scene ${i + 1}: ${s.duration}s is short for its text (~${Math.ceil(needed)}s); the player will extend it`)
    for (const w of s.emphasis ?? []) {
      if (!s.text.toLowerCase().includes(w.toLowerCase())) warnings.push(`scene ${i + 1}: emphasis "${w}" not found in text`)
    }
  })
  const total = totalDuration(e)
  if (total > 90) warnings.push(`total duration ${total}s is long for a short explainer`)
  if (e.sources.every((s) => /wikipedia\.org/.test(s.url))) warnings.push('only Wikipedia sources — add a primary or institutional source')
  return warnings
}

function extraWords(s: Scene) {
  const count = (t: string) => t.split(/\s+/).length
  switch (s.template) {
    case 'comparison': return count(s.left.text) + count(s.right.text)
    case 'timeline': return s.events.reduce((n, e) => n + count(e.what), 0)
    case 'breakdown': return s.items.reduce((n, i) => n + count(i.title) + count(i.detail ?? ''), 0)
    case 'question': return count(s.answer)
    case 'reveal': return count(s.reveal)
    default: return 0
  }
}
