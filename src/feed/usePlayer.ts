import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sceneDuration, type Experience } from '../content/schema'
import { beatsFor } from '../scenes/beats'
import { speak, stopNarration } from '../lib/narration'
import { actions, useSettings } from '../store/store'

/**
 * Drives one experience: a requestAnimationFrame clock that advances scenes,
 * reveals beats and (optionally) waits for narration to finish.
 *
 * The clock only runs while `canPlay` is true (card on screen, tab visible,
 * no sheet open) and the user hasn't paused.
 */
export function usePlayer(exp: Experience, canPlay: boolean) {
  const settings = useSettings()
  const [index, setIndex] = useState(0)
  const [beat, setBeat] = useState(0)
  const [t, setT] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')

  const elapsed = useRef(0)
  const speaking = useRef(false)
  const spoken = useRef(new Set<string>())
  const fillRef = useRef<HTMLDivElement | null>(null)

  const scene = exp.scenes[index]
  const duration = sceneDuration(scene)
  const beats = useMemo(() => beatsFor(scene), [scene])
  const playing = canPlay && pageVisible && !userPaused && !finished

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Count a view the first time the card is actually played.
  const viewed = useRef(false)
  useEffect(() => {
    if (canPlay && !viewed.current) {
      viewed.current = true
      actions.recordView(exp.id)
    }
  }, [canPlay, exp.id])

  // Remember how far we got (used as a soft "skipped" signal).
  useEffect(() => {
    if (index > 0) actions.recordProgress(exp.id, index / exp.scenes.length)
  }, [index, exp])

  const goTo = useCallback((i: number) => {
    elapsed.current = 0
    speaking.current = false
    stopNarration()
    // Revisiting a scene narrates it again.
    spoken.current.delete(`${i}:0`)
    spoken.current.delete(`${i}:1`)
    setT(0)
    setBeat(0)
    setIndex(i)
  }, [])

  const finish = useCallback(() => {
    stopNarration()
    speaking.current = false
    setFinished(true)
    actions.recordCompletion(exp.id)
  }, [exp.id])

  const next = useCallback(() => {
    if (finished) return
    if (index < exp.scenes.length - 1) goTo(index + 1)
    else finish()
  }, [finished, index, exp.scenes.length, goTo, finish])

  const prev = useCallback(() => {
    if (finished) {
      setFinished(false)
      goTo(exp.scenes.length - 1)
    } else if (elapsed.current > 1.5 || index === 0) goTo(index)
    else goTo(index - 1)
  }, [finished, index, exp.scenes.length, goTo])

  const replay = useCallback(() => {
    spoken.current.clear()
    setFinished(false)
    setUserPaused(false)
    goTo(0)
  }, [goTo])

  const jump = useCallback(
    (i: number) => {
      setFinished(false)
      goTo(i)
    },
    [goTo],
  )

  const togglePause = useCallback(() => setUserPaused((p) => !p), [])

  // The clock.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastT = -1
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      elapsed.current += dt
      const e = elapsed.current
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${Math.min(1, e / duration)})`
      const q = Math.floor(e * 10) / 10
      if (q !== lastT) {
        lastT = q
        setT(q)
      }
      // Reveal the next beat when its time has come and the narrator is done.
      const nextBeat = beats[beat + 1]
      if (nextBeat && e >= Math.max(2.5, nextBeat.at * duration) && !speaking.current) {
        setBeat((b) => b + 1)
      } else if (!nextBeat && e >= duration && !speaking.current) {
        next()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, duration, beats, beat, next])

  // Narration: speak each beat once, when it starts.
  useEffect(() => {
    if (!playing || !settings.narration) {
      if (speaking.current) {
        stopNarration()
        speaking.current = false
      }
      return
    }
    const key = `${index}:${beat}`
    const text = beats[beat]?.say
    if (!text || spoken.current.has(key)) return
    speaking.current = true
    let alive = true
    speak(text, { lang: exp.language, rate: settings.narrationRate, voiceURI: settings.voiceURI }).then(() => {
      if (!alive) return
      spoken.current.add(key)
      speaking.current = false
    })
    return () => {
      alive = false
    }
  }, [playing, settings.narration, settings.narrationRate, settings.voiceURI, index, beat, beats, exp.language])

  // Stop talking when this card stops playing for any reason.
  useEffect(() => {
    if (!playing && speaking.current) {
      stopNarration()
      speaking.current = false
    }
  }, [playing])
  useEffect(() => () => stopNarration(), [])

  return {
    index,
    scene,
    beat,
    t,
    duration,
    finished,
    paused: userPaused,
    playing,
    fillRef,
    next,
    prev,
    replay,
    jump,
    togglePause,
  }
}

export type Player = ReturnType<typeof usePlayer>
