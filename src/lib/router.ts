import { useSyncExternalStore } from 'react'

/**
 * Hash routing: works on any static host (GitHub Pages included) without
 * rewrite rules.
 *
 *   #/                 feed, "For you"
 *   #/topic/<id>       feed filtered to one topic
 *   #/x/<id>           feed starting at one experience
 *   #/explore  #/saved  #/settings
 */
export type Route =
  | { tab: 'feed'; topic: string; startId?: string }
  | { tab: 'explore' }
  | { tab: 'saved' }
  | { tab: 'settings' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case 'explore':
      return { tab: 'explore' }
    case 'saved':
      return { tab: 'saved' }
    case 'settings':
      return { tab: 'settings' }
    case 'topic':
      return { tab: 'feed', topic: parts[1] ?? 'all' }
    case 'x':
      return { tab: 'feed', topic: 'all', startId: parts[1] }
    default:
      return { tab: 'feed', topic: 'all' }
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHash() {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}

export function navigate(hash: string) {
  if (window.location.hash !== hash) window.location.hash = hash
}

export const hrefFor = {
  feed: (topic = 'all') => (topic === 'all' ? '#/' : `#/topic/${topic}`),
  experience: (id: string) => `#/x/${encodeURIComponent(id)}`,
}
