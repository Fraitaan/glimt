import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore } from 'react'

let message: { id: number; text: string } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string) {
  message = { id: Date.now(), text }
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    emit()
  }, 2200)
  emit()
}

export function Toaster() {
  const m = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => message,
  )
  return (
    <div className="toaster" aria-live="polite">
      <AnimatePresence>
        {m && (
          <motion.div
            key={m.id}
            className="toast"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {m.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
