import { MotionConfig } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Icon, type IconName } from './components/Icon'
import { Toaster } from './components/Toast'
import { Feed } from './feed/Feed'
import { useT } from './i18n'
import { MotionLevelContext, useResolvedMotion } from './lib/motionLevel'
import { unlockNarration } from './lib/narration'
import { hrefFor, parseRoute, useHash, type Route } from './lib/router'
import { Explore } from './pages/Explore'
import { Saved } from './pages/Saved'
import { Settings } from './pages/Settings'
import { getState, useSettings } from './store/store'

export function App() {
  const t = useT()
  const route = parseRoute(useHash())
  const settings = useSettings()
  const level = useResolvedMotion(settings.animation)

  // The feed stays mounted while you visit other tabs, so you return to the same spot.
  const lastFeed = useRef<Extract<Route, { tab: 'feed' }>>({ tab: 'feed', topic: 'all' })
  if (route.tab === 'feed') lastFeed.current = route
  const feedHref = lastFeed.current.startId
    ? `#/x/${encodeURIComponent(lastFeed.current.startId)}`
    : hrefFor.feed(lastFeed.current.topic)

  useEffect(() => {
    document.documentElement.lang = settings.language
    document.documentElement.dataset.motion = level
  }, [settings.language, level])

  // Browsers (iOS Safari especially) only allow speech after a user gesture.
  useEffect(() => {
    const onGesture = () => {
      if (getState().settings.narration) unlockNarration()
    }
    window.addEventListener('pointerup', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerup', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])

  const tabs: { id: Route['tab']; href: string; icon: IconName; label: string }[] = [
    { id: 'feed', href: feedHref, icon: 'spark', label: t('tab.feed') },
    { id: 'explore', href: '#/explore', icon: 'compass', label: t('tab.explore') },
    { id: 'saved', href: '#/saved', icon: 'bookmark', label: t('tab.saved') },
    { id: 'settings', href: '#/settings', icon: 'sliders', label: t('tab.settings') },
  ]

  return (
    <MotionConfig reducedMotion={level === 'full' ? 'never' : 'always'}>
      <MotionLevelContext.Provider value={level}>
        <div className="app">
          <main className="app-main">
            <Feed visible={route.tab === 'feed'} topic={lastFeed.current.topic} startId={lastFeed.current.startId} />
            {route.tab === 'explore' && <Explore />}
            {route.tab === 'saved' && <Saved />}
            {route.tab === 'settings' && <Settings />}
          </main>
          <nav className="tabbar">
            {tabs.map((tab) => (
              <a key={tab.id} href={tab.href} className={`tab ${route.tab === tab.id ? 'is-on' : ''}`} aria-current={route.tab === tab.id ? 'page' : undefined}>
                <Icon name={tab.icon} size={23} filled={route.tab === tab.id && tab.id === 'saved'} />
                {tab.label}
              </a>
            ))}
          </nav>
          <Toaster />
        </div>
      </MotionLevelContext.Provider>
    </MotionConfig>
  )
}
