import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { CATEGORIES, categoryList } from '../content/categories'
import { useLibrary } from '../content/library'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { ExperienceRow } from '../components/ExperienceRow'
import { hrefFor } from '../lib/router'
import { actions, useAppState, useSettings } from '../store/store'

export function Explore() {
  const t = useT()
  const library = useLibrary()
  const { language, interests } = useSettings()
  const interactions = useAppState((s) => s.interactions)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!q) return []
    return library.filter((e) =>
      [e.title, e.summary, CATEGORIES[e.category].name.en, CATEGORIES[e.category].name.sv, ...e.tags].some((s) => s.toLowerCase().includes(q)),
    )
  }, [library, q])

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('explore.title')}</h1>
        <p className="muted">{t('explore.subtitle')}</p>
      </header>

      <label className="search">
        <Icon name="search" size={20} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('explore.search')} enterKeyHint="search" />
        {query && (
          <button className="icon-btn" onClick={() => setQuery('')} aria-label="Clear">
            <Icon name="close" size={18} />
          </button>
        )}
      </label>

      {q ? (
        <div className="list">
          {results.length === 0 && <p className="muted center">{t('explore.noResults')}</p>}
          {results.map((e) => (
            <ExperienceRow key={e.id} exp={e} seen={!!interactions[e.id]?.views} />
          ))}
        </div>
      ) : (
        <>
          <div className="topic-grid">
            {categoryList.map((c, i) => {
              const count = library.filter((e) => e.category === c.id).length
              const on = interests.includes(c.id)
              return (
                <motion.div
                  key={c.id}
                  className="topic-card"
                  style={{ ['--accent' as string]: c.accent }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <a href={hrefFor.feed(c.id)} className="topic-card-link">
                    <span className="topic-card-name">{c.name[language]}</span>
                    <span className="topic-card-blurb">{c.blurb[language]}</span>
                    <span className="topic-card-count">{t('explore.count', { n: count })}</span>
                  </a>
                  <button
                    className={`topic-like ${on ? 'is-on' : ''}`}
                    onClick={() => actions.toggleInterest(c.id)}
                    aria-pressed={on}
                    aria-label={on ? t('explore.interested') : t('explore.addInterest')}
                    title={on ? t('explore.interested') : t('explore.addInterest')}
                  >
                    <Icon name="heart" size={20} filled={on} />
                  </button>
                </motion.div>
              )
            })}
          </div>

          <h2 className="section-title">{t('explore.all')}</h2>
          <div className="list">
            {library.map((e) => (
              <ExperienceRow key={e.id} exp={e} seen={!!interactions[e.id]?.views} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
