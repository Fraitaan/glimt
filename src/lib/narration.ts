/**
 * Thin wrapper around the browser's speech synthesis.
 *
 * Voices, timing and reliability vary a lot between browsers and devices, so
 * everything here is best-effort: `speak` always resolves (on end, error,
 * cancel or a safety timeout) and the player never waits on it forever.
 */

const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null

export const narrationSupported = !!synth

let unlocked = false

/**
 * iOS Safari only allows speech after a user gesture. Call this from a tap
 * handler; afterwards narration can start on its own.
 */
export function unlockNarration() {
  if (!synth || unlocked) return
  unlocked = true
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
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
    voices.find((v) => v.localService) ??
    voices[0]
  )
}

let current: { cancel: () => void } | null = null

export function stopNarration() {
  current?.cancel()
  current = null
  synth?.cancel()
}

export function speak(text: string, opts: { lang: string; rate: number; voiceURI?: string }): Promise<void> {
  if (!synth || !text.trim()) return Promise.resolve()
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
    const timer = setTimeout(finish, ((words / 2.2) * 1000) / opts.rate + 2500)
    const handle = { cancel: finish }
    current = handle

    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang === 'sv' ? 'sv-SE' : 'en-US'
    u.rate = opts.rate
    const voice = pickVoice(opts.lang, opts.voiceURI)
    if (voice) u.voice = voice
    u.onend = finish
    u.onerror = finish
    // Chrome can get stuck in a paused state after tab switches.
    synth.resume()
    synth.speak(u)
  })
}
