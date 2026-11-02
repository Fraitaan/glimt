import { useEffect, useRef } from 'react'
import { CATEGORIES } from '../content/categories'
import type { Experience, Scene } from '../content/schema'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'

/** Read mode: the full explainer as text, the evidence level and every source. */
export function DetailsSheet({ exp, focus, onClose }: { exp: Experience | null; focus: 'read' | 'sources'; onClose: () => void }) {
  const t = useT()
  const sourcesRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (exp && focus === 'sources') {
      const id = setTimeout(() => sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
      return () => clearTimeout(id)
    }
  }, [exp, focus])

  return (
    <Sheet open={!!exp} onClose={onClose} title={exp ? CATEGORIES[exp.category].name[exp.language] : ''}>
      {exp && (
        <div className="details" style={{ ['--accent' as string]: CATEGORIES[exp.category].accent }}>
          <h1 className="details-title">{exp.title}</h1>
          <p className="details-summary">{exp.summary}</p>

          <section className={`evidence-box evidence-${exp.evidence}`}>
            <div className="evidence-head">
              <span className="evidence-dot" />
              <strong>{t(`evidence.${exp.evidence}`)}</strong>
              <span className="muted">— {t('evidence.title')}</span>
            </div>
            <p>{t(`evidence.${exp.evidence}.desc`)}</p>
            {exp.evidenceNote && <p className="evidence-note">{exp.evidenceNote}</p>}
          </section>

          <section className="transcript">
            {exp.scenes.map((s, i) => (
              <TranscriptScene key={i} scene={s} />
            ))}
          </section>

          <section ref={sourcesRef} className="sources">
            <h3>{t('read.sources')}</h3>
            <ol>
              {exp.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <span className="source-title">{s.title}</span>
                    <span className="source-meta">
                      {s.publisher}
                      {s.year ? `, ${s.year}` : ''}
                    </span>
                    <Icon name="external" size={16} className="source-icon" />
                  </a>
                </li>
              ))}
            </ol>
          </section>

          {exp.tags.length > 0 && (
            <div className="tags">
              {exp.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function TranscriptScene({ scene }: { scene: Scene }) {
  return (
    <div className={`tr tr-${scene.role}`}>
      <p>
        {scene.template === 'stat' && (
          <strong className="tr-stat">
            {scene.prefix}
            {scene.value.toLocaleString()}
            {scene.suffix}{' '}
          </strong>
        )}
        {scene.text}
      </p>
      {scene.template === 'question' && <p className="tr-answer">{scene.answer}</p>}
      {scene.template === 'reveal' && <p className="tr-answer">{scene.reveal}</p>}
      {scene.template === 'comparison' && (
        <ul>
          <li>
            <strong>{scene.left.label}:</strong> {scene.left.text}
          </li>
          <li>
            <strong>{scene.right.label}:</strong> {scene.right.text}
          </li>
        </ul>
      )}
      {scene.template === 'timeline' && (
        <ul>
          {scene.events.map((e, i) => (
            <li key={i}>
              <strong>{e.when}</strong> — {e.what}
            </li>
          ))}
        </ul>
      )}
      {scene.template === 'breakdown' && (
        <ul>
          {scene.items.map((it, i) => (
            <li key={i}>
              <strong>{it.title}</strong>
              {it.detail ? ` — ${it.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
