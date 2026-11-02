import { animate, motion } from 'motion/react'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Scene } from '../content/schema'
import type { TFunction } from '../i18n'
import type { Lang } from '../store/store'
import { useMotionLevel } from '../lib/motionLevel'
import { Illustration } from './illustrations'

export interface SceneProps {
  scene: Scene
  /** Seconds since the scene started (frozen while paused). */
  t: number
  /** Effective duration in seconds. */
  duration: number
  /** Current beat index (two-beat scenes reveal their second part at beat 1). */
  beat: number
  lang: Lang
  t9n: TFunction
}

// ---- text helpers -----------------------------------------------------------

interface Token {
  word: string
  em: boolean
}

/** Splits text into words, flagging the ones inside an emphasis phrase. */
function tokenize(text: string, emphasis: string[] = []): Token[] {
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const phrase of emphasis) {
    const i = lower.indexOf(phrase.toLowerCase())
    if (i >= 0) ranges.push([i, i + phrase.length])
  }
  const tokens: Token[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const start = m.index
    const end = start + m[0].length
    tokens.push({ word: m[0], em: ranges.some(([a, b]) => start < b && end > a) })
  }
  return tokens
}

function sizeClass(text: string) {
  const n = text.length
  if (n < 48) return 'type-xl'
  if (n < 95) return 'type-lg'
  return 'type-md'
}

/**
 * Karaoke: how many words have been "said" at time `t`, so text lights up
 * roughly in step with the narrator (about 2.6 words a second).
 */
function useLitCount(words: number, t: number | undefined, duration = 0, start = 0.35) {
  const level = useMotionLevel()
  if (t === undefined || level === 'minimal') return words
  const perWord = Math.min(0.385, Math.max(0.12, (duration * 0.85 - start) / words))
  return Math.floor((t - start) / perWord) + 1
}

interface TextProps {
  text: string
  emphasis?: string[]
  delay?: number
  className?: string
  /** Scene clock; when given, words light up as they are spoken. */
  t?: number
  duration?: number
  start?: number
}

/** Word-by-word kinetic typography. */
function KineticText({ text, emphasis, delay = 0, className = '', t, duration, start }: TextProps) {
  const level = useMotionLevel()
  const tokens = useMemo(() => tokenize(text, emphasis), [text, emphasis])
  const lit = useLitCount(tokens.length, t, duration, start)
  const stagger = level === 'full' ? Math.min(0.07, 1.4 / tokens.length) : 0.02
  return (
    <p className={`display ${sizeClass(text)} ${className} ${t !== undefined ? 'karaoke' : ''}`}>
      {tokens.map((tok, i) => (
        <Fragment key={i}>
          <motion.span
            className={`word ${tok.em ? 'em' : ''} ${i < lit ? 'lit' : ''}`}
            initial={{ opacity: 0, y: '0.45em', filter: level === 'full' ? 'blur(8px)' : 'blur(0px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, delay: delay + i * stagger, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {tok.word}
          </motion.span>{' '}
        </Fragment>
      ))}
    </p>
  )
}

/** Text with emphasis, faded in as a block. */
function Text({ text, emphasis, className = '', delay = 0, t, duration, start }: TextProps) {
  const tokens = useMemo(() => tokenize(text, emphasis), [text, emphasis])
  const lit = useLitCount(tokens.length, t, duration, start ?? delay)
  return (
    <motion.p
      className={`${className} ${t !== undefined ? 'karaoke' : ''}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {tokens.map((tok, i) => (
        <Fragment key={i}>
          <span className={`${tok.em ? 'em' : ''} ${i < lit ? 'lit' : ''}`}>{tok.word}</span>{' '}
        </Fragment>
      ))}
    </motion.p>
  )
}

function Kicker({ scene, t9n }: { scene: Scene; t9n: TFunction }) {
  const label = t9n(`role.${scene.role}`)
  if (!label) return null
  return (
    <motion.div className="kicker" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
      {label}
    </motion.div>
  )
}

/** How many of `n` staggered items should be visible at time `t`. */
function visibleCount(n: number, t: number, duration: number) {
  const start = 0.9
  const gap = Math.max(0.9, (duration * 0.6) / n)
  return Math.max(0, Math.min(n, Math.floor((t - start) / gap) + 1))
}

// ---- templates --------------------------------------------------------------

function Kinetic({ scene, t, duration }: SceneProps) {
  const isTakeaway = scene.role === 'takeaway'
  return (
    <div className={`tpl tpl-kinetic ${isTakeaway ? 'is-takeaway' : ''}`}>
      {isTakeaway && (
        <motion.div className="rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
      )}
      <KineticText text={scene.text} emphasis={scene.emphasis} delay={isTakeaway ? 0.3 : 0.05} t={t} duration={duration} />
    </div>
  )
}

function IllustrationTpl({ scene, t, duration }: SceneProps) {
  if (scene.template !== 'illustration') return null
  return (
    <div className="tpl tpl-illustration">
      <div className="art float">
        <Illustration name={scene.visual} />
      </div>
      <Text text={scene.text} emphasis={scene.emphasis} className="body-lg" delay={0.35} t={t} duration={duration} />
    </div>
  )
}

function Comparison({ scene, t, duration }: SceneProps) {
  if (scene.template !== 'comparison') return null
  const showRight = t > Math.min(2.2, duration * 0.3)
  return (
    <div className={`tpl tpl-comparison ${showRight ? 'focus-b' : 'focus-a'}`}>
      <Text text={scene.text} emphasis={scene.emphasis} className="heading" t={t} duration={Math.min(duration, 4)} />
      <div className="versus">
        <motion.div className="side side-a" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
          <div className="side-label">{scene.left.label}</div>
          <div className="side-text">{scene.left.text}</div>
        </motion.div>
        <motion.div
          className="vs"
          initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
          animate={{ opacity: showRight ? 1 : 0, scale: showRight ? 1 : 0.5, rotate: showRight ? 0 : -180 }}
          transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1.2] }}
        >
          vs
        </motion.div>
        <motion.div className="side side-b" initial={{ opacity: 0, x: 24 }} animate={{ opacity: showRight ? 1 : 0, x: showRight ? 0 : 24 }} transition={{ duration: 0.6 }}>
          <div className="side-label">{scene.right.label}</div>
          <div className="side-text">{scene.right.text}</div>
        </motion.div>
      </div>
    </div>
  )
}

function Timeline({ scene, t, duration }: SceneProps) {
  if (scene.template !== 'timeline') return null
  const shown = visibleCount(scene.events.length, t, duration)
  return (
    <div className="tpl tpl-timeline">
      <Text text={scene.text} emphasis={scene.emphasis} className="heading" t={t} duration={Math.min(duration, 3)} />
      <ol className="timeline">
        <motion.span
          className="timeline-line"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: shown / scene.events.length }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        {scene.events.map((e, i) => (
          <motion.li
            key={i}
            className={i === shown - 1 ? 'is-new' : undefined}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: i < shown ? 1 : 0.0, x: i < shown ? 0 : 16 }}
            transition={{ duration: 0.5 }}
          >
            <span className="dot" />
            <span className="when">{e.when}</span>
            <span className="what">{e.what}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

const SPARKS = Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2 + 0.3)

function Stat({ scene, lang, t, duration }: SceneProps) {
  const level = useMotionLevel()
  const value = scene.template === 'stat' ? scene.value : 0
  const decimals = scene.template === 'stat' ? scene.decimals ?? 0 : 0
  const [shown, setShown] = useState(level === 'minimal' ? value : 0)
  useEffect(() => {
    if (level === 'minimal') return setShown(value)
    const controls = animate(0, value, { duration: 1.6, delay: 0.3, ease: [0.15, 0.8, 0.25, 1], onUpdate: setShown })
    return () => controls.stop()
  }, [value, level])
  if (scene.template !== 'stat') return null
  const fmt = new Intl.NumberFormat(lang === 'sv' ? 'sv-SE' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  // Long numbers get a smaller size so they always fit on one line.
  const chars = (scene.prefix ?? '').length + fmt.format(value).length + (scene.suffix ?? '').length * 0.45
  const scale = chars <= 4 ? 1 : chars <= 6 ? 0.8 : chars <= 8 ? 0.64 : 0.52
  return (
    <div className="tpl tpl-stat">
      <motion.div
        className="stat"
        style={{ fontSize: `calc(var(--stat-size) * ${scale})` }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        {scene.prefix && <span className="stat-affix">{scene.prefix}</span>}
        <span className="stat-value">{fmt.format(shown)}</span>
        {scene.suffix && <span className="stat-affix">{scene.suffix}</span>}
      </motion.div>
      <div className="stat-meter" aria-hidden>
        <span className="stat-meter-fill" style={{ transform: `scaleX(${value ? shown / value : 1})` }} />
        {level !== 'minimal' && shown === value && (
          <span className="sparks">
            {SPARKS.map((a, i) => (
              <motion.i
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 46, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            ))}
          </span>
        )}
      </div>
      <Text text={scene.text} emphasis={scene.emphasis} className="body-md" delay={0.9} t={t} duration={duration} />
    </div>
  )
}

function Breakdown({ scene, t, duration }: SceneProps) {
  if (scene.template !== 'breakdown') return null
  const shown = visibleCount(scene.items.length, t, duration)
  return (
    <div className="tpl tpl-breakdown">
      <Text text={scene.text} emphasis={scene.emphasis} className="heading" t={t} duration={Math.min(duration, 3)} />
      <ul className="items">
        {scene.items.map((it, i) => (
          <motion.li
            key={i}
            className={i === shown - 1 ? 'is-new' : undefined}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: i < shown ? 1 : 0, y: i < shown ? 0 : 18 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="item-title">{it.title}</span>
              {it.detail && <span className="item-detail">{it.detail}</span>}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

function Question({ scene, beat, t, duration }: SceneProps) {
  if (scene.template !== 'question') return null
  const revealed = beat >= 1
  return (
    <div className="tpl tpl-question">
      <motion.div
        className="qmark"
        initial={{ opacity: 0, rotate: -12, scale: 0.8 }}
        animate={{ opacity: revealed ? 0.05 : 0.13, rotate: revealed ? 14 : 0, scale: revealed ? 1.25 : 1 }}
        transition={{ duration: 0.8 }}
      >
        <span className="qmark-glyph">?</span>
      </motion.div>
      <KineticText text={scene.text} emphasis={scene.emphasis} className={revealed ? 'dimmed' : ''} t={t} duration={duration * 0.42} />
      {revealed ? (
        <motion.div className="answer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}>
          <span className="flash" aria-hidden />
          {scene.answer}
        </motion.div>
      ) : (
        <div className="thinking" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  )
}

function Reveal({ scene, beat, t, duration }: SceneProps) {
  if (scene.template !== 'reveal') return null
  const revealed = beat >= 1
  return (
    <div className="tpl tpl-reveal">
      {scene.visual && (
        <div className="art art-sm">
          <Illustration name={scene.visual} size={120} />
        </div>
      )}
      <Text text={scene.text} emphasis={scene.emphasis} className={`body-lg ${revealed ? 'dimmed' : ''}`} t={t} duration={duration * 0.42} />
      {revealed && (
        <motion.div
          className="reveal"
          initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration: 0.9, ease: [0.6, 0, 0.2, 1] }}
        >
          {scene.reveal}
        </motion.div>
      )}
    </div>
  )
}

const TEMPLATES: Record<Scene['template'], (p: SceneProps) => ReactNode> = {
  kinetic: Kinetic,
  illustration: IllustrationTpl,
  comparison: Comparison,
  timeline: Timeline,
  stat: Stat,
  breakdown: Breakdown,
  question: Question,
  reveal: Reveal,
}

/** The word a scene is "about": its first emphasis, else its longest word. */
function ghostWord(scene: Scene) {
  if (scene.template === 'stat') return null
  const pick = scene.emphasis?.[0] ?? scene.text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '')
  const word = pick.replace(/[^\p{L}\p{N}\s'’-]/gu, '').trim()
  return word.length >= 4 ? word : null
}

export function SceneView(props: SceneProps) {
  const Tpl = TEMPLATES[props.scene.template]
  const ghost = useMemo(() => ghostWord(props.scene), [props.scene])
  return (
    <div className="scene-inner">
      {ghost && (
        <div className="ghost" aria-hidden>
          {ghost}
        </div>
      )}
      <Kicker scene={props.scene} t9n={props.t9n} />
      <Tpl {...props} />
    </div>
  )
}
