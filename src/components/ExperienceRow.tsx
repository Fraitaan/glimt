import type { ReactNode } from 'react'
import { CATEGORIES } from '../content/categories'
import { totalDuration, type Experience } from '../content/schema'
import { useT } from '../i18n'
import { hrefFor } from '../lib/router'
import { useSettings } from '../store/store'
import { Icon } from './Icon'

/** A compact list row that opens the experience in the feed. */
export function ExperienceRow({ exp, seen, action }: { exp: Experience; seen?: boolean; action?: ReactNode }) {
  const t = useT()
  const { language } = useSettings()
  const cat = CATEGORIES[exp.category]
  return (
    <div className="row" style={{ ['--accent' as string]: cat.accent }}>
      <a className="row-link" href={hrefFor.experience(exp.id)}>
        <span className="row-bar" />
        <span className="row-body">
          <span className="row-cat">
            {cat.name[language]} · {t('read.minutes', { n: Math.round(totalDuration(exp)) })}
            {seen && <span className="row-seen">· {t('explore.seen')}</span>}
          </span>
          <span className="row-title">{exp.title}</span>
          <span className="row-summary">{exp.summary}</span>
        </span>
        {!action && <Icon name="chevronRight" size={18} className="row-chevron" />}
      </a>
      {action}
    </div>
  )
}
