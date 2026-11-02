import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from '../content/categories'
import { useExperienceIndex, useLibrary } from '../content/library'
import type { Experience } from '../content/schema'
import { useT } from '../i18n'
import { toast } from '../components/Toast'
import { buildQueue } from '../lib/recommend'
import { useMotionLevel } from '../lib/motionLevel'
import { actions, getState, useAppState } from '../store/store'
import { DetailsSheet } from './DetailsSheet'
import { ExperienceCard, type PlayerCommand } from './ExperienceCard'
import { TopicSheet } from './TopicSheet'

const command = (cmd: PlayerCommand) => window.dispatchEvent(new CustomEvent('player-command', { detail: cmd }))

/** Full-screen vertical feed with native scroll snapping (smooth on iOS and Android). */
export function Feed({ visible, topic, startId }: { visible: boolean; topic: string; startId?: string }) {
  const t = useT()
  const library = useLibrary()
  const index = useExperienceIndex()
  const lang = useAppState((s) => s.settings.language)
  const hintSeen = useAppState((s) => s.hints.includes('gestures'))
  const level = useMotionLevel()

  const [queue, setQueue] = useState<Experience[]>([])
  const [active, setActive] = useState(0)
  const [details, setDetails] = useState<{ exp: Experience; focus: 'read' | 'sources' } | null>(null)
  const [topicsOpen, setTopicsOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const topicId: CategoryId | 'all' = (CATEGORY_IDS as readonly string[]).includes(topic) ? (topic as CategoryId) : 'all'

  // (Re)build the queue when the topic, start item or available content changes.
  // Interactions are read once here on purpose: liking something shouldn't reshuffle the feed under you.
  useEffect(() => {
    const { interactions, settings } = getState()
    let pool = library
    // Deep links may point to a translation that isn't in the language-resolved library.
    const start = startId ? index.get(startId) : undefined
    if (start && !pool.some((e) => e.id === start.id)) pool = [start, ...pool]
    setQueue(buildQueue(pool, interactions, settings, { topic: topicId, startId: start?.id }))
    setActive(0)
    scroller.current?.scrollTo({ top: 0 })
  }, [topicId, startId, library, index])

  // Infinite feed: when nearing the end, append another round.
  useEffect(() => {
    if (!queue.length || active < queue.length - 3) return
    const { interactions, settings } = getState()
    const avoid = new Set(queue.slice(-6).map((e) => e.id))
    const more = buildQueue(library, interactions, settings, { topic: topicId, avoid })
    if (!more.length) return
    if (more.every((e) => interactions[e.id]?.views)) toast(t('feed.loopNotice'))
    setQueue((q) => [...q, ...more])
  }, [active, queue, library, topicId, t])

  // Track which card is on screen.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [queue])

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scroller.current
      if (!el) return
      el.scrollTo({ top: i * el.clientHeight, behavior: level === 'minimal' ? 'auto' : 'smooth' })
    },
    [level],
  )

  const sheetOpen = !!details || topicsOpen
  const hintOpen = visible && !hintSeen && queue.length > 0

  // Keyboard controls (desktop).
  useEffect(() => {
    if (!visible || sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const map: Record<string, () => void> = {
        ArrowDown: () => scrollToIndex(active + 1),
        PageDown: () => scrollToIndex(active + 1),
        j: () => scrollToIndex(active + 1),
        ArrowUp: () => scrollToIndex(active - 1),
        PageUp: () => scrollToIndex(active - 1),
        k: () => scrollToIndex(active - 1),
        ' ': () => command('toggle'),
        ArrowRight: () => command('next'),
        ArrowLeft: () => command('prev'),
        s: () => command('save'),
        r: () => command('replay'),
      }
      const fn = map[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, sheetOpen, active, scrollToIndex])

  const topicLabel = topicId === 'all' ? t('feed.forYou') : CATEGORIES[topicId].name[lang]

  return (
    <div className="feed-wrap" hidden={!visible}>
      <div className="feed" ref={scroller}>
        {queue.length === 0 && <div className="feed-empty">{t('feed.empty')}</div>}
        {queue.map((exp, i) => (
          <section key={`${exp.id}-${i}`} className="slot" data-index={i}>
            {Math.abs(i - active) <= 1 ? (
              <ExperienceCard
                exp={exp}
                isActive={i === active}
                canPlay={visible && i === active && !sheetOpen && !hintOpen}
                topicLabel={topicLabel}
                onTopicClick={() => setTopicsOpen(true)}
                onDetails={(e, focus) => setDetails({ exp: e, focus })}
                onAdvance={() => scrollToIndex(i + 1)}
                upNext={queue[i + 1]}
              />
            ) : (
              <div className="slot-placeholder" style={{ ['--accent' as string]: CATEGORIES[exp.category].accent }} />
            )}
          </section>
        ))}
      </div>

      <AnimatePresence>
        {hintOpen && (
          <motion.div className="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="hint-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
              <div className="hint-zones" aria-hidden>
                <span>‹</span>
                <span>❙❙</span>
                <span>›</span>
              </div>
              <p>{t('feed.hint')}</p>
              <button className="btn btn-primary" onClick={() => actions.markHint('gestures')}>
                {t('feed.gotIt')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DetailsSheet exp={details?.exp ?? null} focus={details?.focus ?? 'read'} onClose={() => setDetails(null)} />
      <TopicSheet open={topicsOpen} onClose={() => setTopicsOpen(false)} current={topicId} library={library} />
    </div>
  )
}
