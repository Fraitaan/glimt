/**
 * Narration: pre-recorded neural-voice clips (scripts/narrate.ts) when the line
 * has one, otherwise the browser's speech synthesis.
 *
 * Voices, timing and reliability vary a lot between browsers and devices, so
 * everything here is best-effort: `speak` always resolves (on end, error,
 * cancel or a safety timeout) and the player never waits on it forever.
 */
import clips from '../../content/narration.json'
import { narrationKey } from './narrationKey'

const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
const audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null

export const narrationSupported = !!synth || !!audio

const clipIndex = clips as Record<string, string>
function clipUrl(lang: string, text: string) {
  const file = clipIndex[narrationKey(lang, text)]
  return file ? `${import.meta.env.BASE_URL}narration/${file}` : undefined
}

// A tiny silent WAV, played inside a tap so iOS lets the audio element play later.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

let unlocked = false

/**
 * iOS Safari only allows speech after a user gesture. Call this from a tap
 * handler; afterwards narration can start on its own.
 */
export function unlockNarration() {
  if (unlocked) return
  unlocked = true
  if (audio) {
    audio.src = SILENCE
    audio.play().catch(() => {})
  }
  if (synth) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  }
}

export const isNarrationUnlocked = () => unlocked

export function getVoices(lang?: string): SpeechSynthesisVoice[] {
  if (!synth) return []
  const all = synth.getVoices()
  return lang ? all.filter((v) => v.lang.toLowerCase().startsWith(lang)) : all
}

export function onVoicesChanged(cb: () => void) {
  if (!synth) return () => {}
  synth.addEventListener('voiceschanged', cb)
  return () => synth.removeEventListener('voiceschanged', cb)
}

function pickVoice(lang: string, voiceURI?: string) {
  const voices = getVoices(lang)
  return (
    voices.find((v) => v.voiceURI === voiceURI) ??
    // Prefer higher-quality voices when the platform labels them.
    voices.find((v) => /natural|premium|enhanced|neural/i.test(v.name)) ??
    // Online voices (e.g. "Google UK English Female") beat the old offline
    // Windows ones (David, Zira, Bengt) by a mile.
    voices.find((v) => !v.localService) ??
    voices[0]
  )
}

let current: { cancel: () => void } | null = null

export function stopNarration() {
  current?.cancel()
  current = null
  synth?.cancel()
  audio?.pause()
}

/**
 * Speaks `text`. With no device voice chosen (`voiceURI` unset), lines that
 * have a pre-recorded clip play that instead.
 */
export function speak(text: string, opts: { lang: string; rate: number; voiceURI?: string }): Promise<void> {
  if (!text.trim()) return Promise.resolve()
  const clip = !opts.voiceURI && audio ? clipUrl(opts.lang, text) : undefined
  if (!clip && !synth) return Promise.resolve()
  stopNarration()

  return new Promise<void>((resolve) => {
    let settled = false
    const words = text.split(/\s+/).length
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (current === handle) current = null
      resolve()
    }
    // Some browsers never fire `end` (or fire it far too late). Don't let that stall the player.
    let timer = setTimeout(finish, ((words / 2.2) * 1000) / opts.rate + 2500)
    const handle = { cancel: finish }
    current = handle

    if (clip && audio) {
      clearTimeout(timer)
      timer = setTimeout(finish, 20000) // loading; replaced once the length is known
      audio.onloadedmetadata = () => {
        if (settled) return
        clearTimeout(timer)
        timer = setTimeout(finish, (audio.duration / opts.rate) * 1000 + 2000)
      }
      audio.onended = finish
      audio.onerror = finish
      audio.src = clip
      audio.defaultPlaybackRate = opts.rate
      audio.playbackRate = opts.rate
      audio.play().catch(finish)
      return
    }

    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang === 'sv' ? 'sv-SE' : 'en-US'
    u.rate = opts.rate
    const voice = pickVoice(opts.lang, opts.voiceURI)
    if (voice) u.voice = voice
    u.onend = finish
    u.onerror = finish
    // Chrome can get stuck in a paused state after tab switches.
    synth!.resume()
    synth!.speak(u)
  })
}
