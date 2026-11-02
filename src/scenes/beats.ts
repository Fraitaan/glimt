import type { Scene } from '../content/schema'

/**
 * A scene plays as one or two "beats". Two-beat scenes (question, reveal)
 * show the second part partway through; narration speaks each beat in turn.
 */
export interface Beat {
  /** Fraction of the scene duration at which this beat starts. */
  at: number
  say: string
}

export function beatsFor(s: Scene): Beat[] {
  const main = s.narration ?? s.text
  switch (s.template) {
    case 'question':
      return [{ at: 0, say: main }, { at: 0.42, say: s.answer }]
    case 'reveal':
      return [{ at: 0, say: main }, { at: 0.42, say: s.reveal }]
    case 'comparison':
      return [{ at: 0, say: s.narration ?? `${s.text} ${s.left.label}: ${s.left.text}. ${s.right.label}: ${s.right.text}.` }]
    case 'timeline':
      return [{ at: 0, say: s.narration ?? `${s.text}. ${s.events.map((e) => `${e.when}: ${e.what}.`).join(' ')}` }]
    case 'breakdown':
      return [{ at: 0, say: s.narration ?? `${s.text} ${s.items.map((i) => `${i.title}. ${i.detail ?? ''}`).join(' ')}` }]
    default:
      return [{ at: 0, say: main }]
  }
}
