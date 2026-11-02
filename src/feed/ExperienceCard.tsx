import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { CATEGORIES } from '../content/categories'
import { totalDuration, type Experience } from '../content/schema'
import { useT } from '../i18n'
import { Icon, type IconName } from '../components/Icon'
import { toast } from '../components/Toast'
import { isNarrationUnlocked, narrationSupported, unlockNarration } from '../lib/narration'
import { useMotionLevel } from '../lib/motionLevel'
import { SceneView } from '../scenes/SceneView'
import { actions, useAppState, useSettings } from '../store/store'
import { usePlayer } from './usePlayer'

export type PlayerCommand = 'toggle' | 'next' | 'prev' | 'save' | 'replay'

interface Props {
  exp: Experience
  canPlay: boolean
  isActive: boolean
  topicLabel: string
  onTopicClick: () => void
  onDetails: (exp: Experience, focus: 'read' | 'sources') => void
  onAdvance: () => void
  upNext?: Experience
}

const EASE = [0.2, 0.7, 0.2, 1] as const

/** Scene changes: the first scene zooms in, the rest rotate through these. */
const TRANSITIONS = [
  {
    initial: { opacity: 0, scale: 1.14, filter: 'blur(14px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 0.94, filter: 'blur(8px)' },
    transition: { duration: 0.7, ease: EASE },
  },
  {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60, filter: 'blur(6px)' },
    transition: { duration: 0.55, ease: EASE },
  },
  {
    initial: { opacity: 0, y: 40, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -30, filter: 'blur(6px)' },
    transition: { duration: 0.55, ease: EASE },
  },
  {
    initial: { opacity: 0, clipPath: 'inset(100% 0 0 0)' },
    animate: { opacity: 1, clipPath: 'inset(0% 0 0 0)' },
    exit: { opacity: 0, scale: 1.06, filter: 'blur(10px)' },
    transition: { duration: 0.7, ease: [0.6, 0, 0.2, 1] as const },
  },
  {
    initial: { opacity: 0, scale: 0.86, rotate: -2 },
    animate: { opacity: 1, scale: 1, rotate: 0 },
    exit: { opacity: 0, x: 40, filter: 'blur(6px)' },
    transition: { duration: 0.6, ease: [0.2, 0.9, 0.3, 1.1] as const },
  },
]

/** Where the background colour fields drift to on each scene. */
const BLOB_POSITIONS = [
  ['0%', '0%'],
  ['38%', '22%'],
  ['10%', '55%'],
  ['-12%', '30%'],
  ['30%', '-8%'],
  ['22%', '48%'],
]

// Floating specks of light; fixed so cards don't reshuffle on re-render.
const MOTES: CSSProperties[] = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return {
    left: `${r(1) * 100}%`,
    top: `${40 + r(2) * 70}%`,
    width: `${2 + r(3) * 4}px`,
    animationDuration: `${9 + r(4) * 12}s`,
    animationDelay: `${-r(5) * 20}s`,
  } as CSSProperties
})

export function ExperienceCard({ exp, canPlay, isActive, topicLabel, onTopicClick, onDetails, onAdvance, upNext }: Props) {
  const t = useT()
  const settings = useSettings()
  const level = useMotionLevel()
  const interaction = useAppState((s) => s.interactions[exp.id])
  const player = usePlayer(exp, canPlay)
  const cat = CATEGORIES[exp.category]
  const [needsUnlock, setNeedsUnlock] = useState(false)

  useEffect(() => {
    setNeedsUnlock(settings.narration && narrationSupported && !isNarrationUnlocked())
  }, [settings.narration, canPlay])

  // Keyboard and other external commands, routed to the active card only.
  useEffect(() => {
    if (!isActive) return
    const onCmd = (e: Event) => {
      const cmd = (e as CustomEvent<PlayerCommand>).detail
      if (cmd === 'toggle') player.togglePause()
      else if (cmd === 'next') player.next()
      else if (cmd === 'prev') player.prev()
      else if (cmd === 'replay') player.replay()
      else if (cmd === 'save') save()
    }
    window.addEventListener('player-command', onCmd)
    return () => window.removeEventListener('player-command', onCmd)
  })

  const save = () => {
    const wasSaved = !!interaction?.savedAt
    actions.toggleSave(exp.id)
    if (!wasSaved) toast(t('feed.toastSaved'))
  }

  const onStageTap = (e: MouseEvent<HTMLDivElement>) => {
    if (needsUnlock) {
      unlockNarration()
      setNeedsUnlock(false)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    if (x < 0.22) player.prev()
    else if (x > 0.78) player.next()
    else player.togglePause()
  }

  const rail: { icon: IconName; label: string; active?: boolean; filled?: boolean; onClick: () => void }[] = [
    {
      icon: 'heart',
      label: t('feed.like'),
      active: interaction?.reaction === 1,
      filled: interaction?.reaction === 1,
      onClick: () => {
        if (interaction?.reaction !== 1) toast(t('feed.toastLiked'))
        actions.react(exp.id, 1)
      },
    },
    {
      icon: 'thumbDown',
      label: t('feed.dislike'),
      active: interaction?.reaction === -1,
      onClick: () => {
        if (interaction?.reaction !== -1) toast(t('feed.toastLess'))
        actions.react(exp.id, -1)
      },
    },
    { icon: 'bookmark', label: interaction?.savedAt ? t('feed.saved') : t('feed.save'), active: !!interaction?.savedAt, filled: !!interaction?.savedAt, onClick: save },
    ...(narrationSupported
      ? [
          {
            icon: (settings.narration ? 'soundOn' : 'soundOff') as IconName,
            label: t('feed.sound'),
            active: settings.narration,
            onClick: () => {
              unlockNarration()
              actions.updateSettings({ narration: !settings.narration })
            },
          },
        ]
      : []),
    { icon: 'text', label: t('feed.read'), onClick: () => onDetails(exp, 'read') },
  ]

  const scenePos = BLOB_POSITIONS[player.index % BLOB_POSITIONS.length]
  const style = { '--accent': cat.accent, '--bx': scenePos[0], '--by': scenePos[1] } as CSSProperties
  const sceneMotion =
    level === 'minimal'
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
      : level === 'reduced'
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.4 } }
        : TRANSITIONS[player.index === 0 ? 0 : 1 + ((player.index - 1) % (TRANSITIONS.length - 1))]

  return (
    <article className={`card ${player.playing ? 'is-playing' : 'is-paused'}`} style={style} aria-label={exp.title}>
      <div className="card-bg" aria-hidden>
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        {level === 'full' && MOTES.map((m, i) => <span key={i} className="mote" style={m} />)}
      </div>

      <header className="card-top">
        <div className="segments" role="tablist">
          {exp.scenes.map((_, i) => (
            <button key={i} className="seg" onClick={() => player.jump(i)} aria-label={`${i + 1} / ${exp.scenes.length}`}>
              <span
                className="seg-fill"
                ref={i === player.index && !player.finished ? player.fillRef : undefined}
                style={{
                  transform: `scaleX(${
                    player.finished || i < player.index ? 1 : i > player.index ? 0 : Math.min(1, player.t / player.duration)
                  })`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="card-toprow">
          <button className="topic-pill" onClick={onTopicClick}>
            {topicLabel}
            <Icon name="chevronDown" size={16} />
          </button>
          <div className="toprow-right">
            {needsUnlock && (
              <button
                className="chip chip-accent"
                onClick={() => {
                  unlockNarration()
                  setNeedsUnlock(false)
                }}
              >
                <Icon name="soundOn" size={16} /> {t('feed.tapForSound')}
              </button>
            )}
            <button className="icon-btn" onClick={player.replay} aria-label={t('feed.replay')}>
              <Icon name="replay" size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="stage" onClick={onStageTap}>
        <AnimatePresence initial={false}>
          <motion.div key={player.index} className="scene" {...sceneMotion}>
            {/* Slow "camera" move over the whole scene; a CSS animation so it pauses with the card. */}
            <div className={`camera cam-${player.index % 4}`} style={{ '--dur': `${player.duration}s` } as CSSProperties}>
              <SceneView scene={player.scene} t={player.t} duration={player.duration} beat={player.beat} lang={exp.language} t9n={t} />
            </div>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {player.paused && !player.finished && (
            <motion.div
              className="pause-badge"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.2 }}
              aria-label={t('feed.paused')}
            >
              <Icon name="play" size={34} filled />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="card-meta">
        <div className="meta-cat">
          <span className="cat-dot" />
          {cat.name[settings.language]}
          <span className="sep">·</span>
          {t('read.minutes', { n: Math.round(totalDuration(exp)) })}
        </div>
        <h2 className="meta-title">{exp.title}</h2>
        <div className="meta-chips">
          <button className={`chip evidence evidence-${exp.evidence}`} onClick={() => onDetails(exp, 'sources')}>
            <span className="evidence-dot" />
            {t(`evidence.${exp.evidence}`)}
          </button>
          <button className="chip" onClick={() => onDetails(exp, 'sources')}>
            <Icon name="sources" size={15} />
            {t('feed.sources')} · {exp.sources.length}
          </button>
        </div>
      </footer>

      <aside className="rail">
        {rail.map((r) => (
          <button key={r.icon} className={`rail-btn ${r.active ? 'is-active' : ''}`} onClick={r.onClick} aria-label={r.label} aria-pressed={r.active}>
            <motion.span className="rail-icon" whileTap={{ scale: 0.82 }}>
              <Icon name={r.icon} size={25} filled={r.filled} />
            </motion.span>
            <span className="rail-label">{r.label}</span>
          </button>
        ))}
      </aside>

      <AnimatePresence>
        {player.finished && (
          <EndCard
            exp={exp}
            upNext={upNext}
            canCount={canPlay && settings.autoAdvance}
            saved={!!interaction?.savedAt}
            onReplay={player.replay}
            onSave={save}
            onRead={() => onDetails(exp, 'read')}
            onNext={onAdvance}
          />
        )}
      </AnimatePresence>
    </article>
  )
}

function EndCard({
  exp,
  upNext,
  canCount,
  saved,
  onReplay,
  onSave,
  onRead,
  onNext,
}: {
  exp: Experience
  upNext?: Experience
  canCount: boolean
  saved: boolean
  onReplay: () => void
  onSave: () => void
  onRead: () => void
  onNext: () => void
}) {
  const t = useT()
  const lang = useAppState((s) => s.settings.language)
  const [left, setLeft] = useState(6)
  const takeaway = [...exp.scenes].reverse().find((s) => s.role === 'takeaway') ?? exp.scenes[exp.scenes.length - 1]

  useEffect(() => {
    if (!canCount) return
    if (left <= 0) {
      onNext()
      return
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [canCount, left, onNext])

  return (
    <motion.div className="endcard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <motion.div className="endcard-inner" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.5 }}>
        <div className="kicker">{t('feed.done')}</div>
        <p className="endcard-takeaway">{takeaway.text}</p>
        <div className="endcard-actions">
          <button className="btn btn-ghost" onClick={onReplay}>
            <Icon name="replay" size={18} /> {t('feed.replay')}
          </button>
          <button className={`btn btn-ghost ${saved ? 'is-on' : ''}`} onClick={onSave}>
            <Icon name="bookmark" size={18} filled={saved} /> {saved ? t('feed.saved') : t('feed.save')}
          </button>
          <button className="btn btn-ghost" onClick={onRead}>
            <Icon name="sources" size={18} /> {t('feed.sources')}
          </button>
        </div>
        {upNext && (
          <button className="upnext" onClick={onNext}>
            <span className="upnext-label">{canCount ? t('feed.nextIn', { n: left }) : t('feed.upNext')}</span>
            <span className="upnext-title">{upNext.title}</span>
            <span className="upnext-cat" style={{ color: CATEGORIES[upNext.category].accent }}>
              {CATEGORIES[upNext.category].name[lang]}
            </span>
            <Icon name="chevronDown" size={22} className="upnext-arrow" />
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}
