import { useMemo } from 'react'
import { useExperienceIndex } from '../content/library'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { ExperienceRow } from '../components/ExperienceRow'
import { actions, useAppState } from '../store/store'

export function Saved() {
  const t = useT()
  const index = useExperienceIndex()
  const interactions = useAppState((s) => s.interactions)

  const saved = useMemo(
    () =>
      Object.entries(interactions)
        .filter(([id, i]) => i.savedAt && index.has(id))
        .sort((a, b) => (b[1].savedAt ?? 0) - (a[1].savedAt ?? 0))
        .map(([id]) => index.get(id)!),
    [interactions, index],
  )

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('saved.title')}</h1>
      </header>
      {saved.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="bookmark" size={34} />
          </div>
          <h2>{t('saved.empty')}</h2>
          <p className="muted">{t('saved.emptyHint')}</p>
        </div>
      ) : (
        <div className="list">
          {saved.map((e) => (
            <ExperienceRow
              key={e.id}
              exp={e}
              action={
                <button className="icon-btn row-action" onClick={() => actions.toggleSave(e.id)} aria-label={t('saved.remove')} title={t('saved.remove')}>
                  <Icon name="bookmark" size={20} filled />
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
