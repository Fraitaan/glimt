import { categoryList } from '../content/categories'
import type { Experience } from '../content/schema'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { hrefFor, navigate } from '../lib/router'
import { useSettings } from '../store/store'

export function TopicSheet({ open, onClose, current, library }: { open: boolean; onClose: () => void; current: string; library: Experience[] }) {
  const t = useT()
  const { language } = useSettings()
  const pick = (topic: string) => {
    onClose()
    navigate(hrefFor.feed(topic))
  }
  const options = [
    { id: 'all', name: t('feed.forYou'), accent: 'var(--text)', count: library.length },
    ...categoryList.map((c) => ({ id: c.id, name: c.name[language], accent: c.accent, count: library.filter((e) => e.category === c.id).length })),
  ].filter((o) => o.count > 0)

  return (
    <Sheet open={open} onClose={onClose} title={t('feed.chooseTopic')}>
      <ul className="topic-list">
        {options.map((o) => (
          <li key={o.id}>
            <button className={`topic-row ${current === o.id ? 'is-current' : ''}`} onClick={() => pick(o.id)}>
              <span className="topic-swatch" style={{ background: o.accent }} />
              <span className="topic-name">{o.name}</span>
              <span className="topic-count">{o.count}</span>
              {current === o.id && <Icon name="check" size={18} />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
