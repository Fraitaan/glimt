import { useEffect, useRef, useState, type ReactNode } from 'react'
import { categoryList } from '../content/categories'
import { curated, useLibrary } from '../content/library'
import { buildPrompt } from '../content/prompt'
import { experienceSchema } from '../content/schema'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { toast } from '../components/Toast'
import { getVoices, narrationSupported, onVoicesChanged, speak, unlockNarration } from '../lib/narration'
import { hrefFor, navigate } from '../lib/router'
import { actions, useAppState, useSettings, type AnimationLevel, type Mix } from '../store/store'

export function Settings() {
  const t = useT()
  const s = useSettings()

  return (
    <div className="page settings">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
      </header>

      <Section title={t('settings.language')}>
        <Segmented
          value={s.language}
          options={[
            { value: 'en', label: 'English' },
            { value: 'sv', label: 'Svenska' },
          ]}
          onChange={(language) => actions.updateSettings({ language })}
        />
        {s.language !== 'en' && (
          <Toggle
            label={t('settings.otherLanguages')}
            desc={t('settings.otherLanguages.desc')}
            checked={s.otherLanguages}
            onChange={(otherLanguages) => actions.updateSettings({ otherLanguages })}
          />
        )}
      </Section>

      <Section title={t('settings.narration')}>
        {narrationSupported ? (
          <>
            <Toggle
              label={t('settings.narration')}
              desc={t('settings.narration.desc')}
              checked={s.narration}
              onChange={(narration) => {
                unlockNarration()
                actions.updateSettings({ narration })
              }}
            />
            <Slider
              label={t('settings.speed')}
              min={0.7}
              max={1.5}
              step={0.05}
              value={s.narrationRate}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(narrationRate) => actions.updateSettings({ narrationRate })}
            />
            <VoicePicker />
          </>
        ) : (
          <p className="muted">{t('settings.narration.unsupported')}</p>
        )}
      </Section>

      <Section title={t('settings.animation')}>
        <Segmented<AnimationLevel>
          value={s.animation}
          options={[
            { value: 'auto', label: t('settings.anim.auto') },
            { value: 'full', label: t('settings.anim.full') },
            { value: 'reduced', label: t('settings.anim.reduced') },
            { value: 'minimal', label: t('settings.anim.minimal') },
          ]}
          onChange={(animation) => actions.updateSettings({ animation })}
        />
        <Toggle
          label={t('settings.autoAdvance')}
          desc={t('settings.autoAdvance.desc')}
          checked={s.autoAdvance}
          onChange={(autoAdvance) => actions.updateSettings({ autoAdvance })}
        />
      </Section>

      <Section title={t('settings.interests')} desc={t('settings.interests.desc')}>
        <div className="chip-wrap">
          {categoryList.map((c) => {
            const on = s.interests.includes(c.id)
            return (
              <button
                key={c.id}
                className={`chip chip-toggle ${on ? 'is-on' : ''}`}
                style={{ ['--accent' as string]: c.accent }}
                onClick={() => actions.toggleInterest(c.id)}
                aria-pressed={on}
              >
                {on && <Icon name="check" size={14} />}
                {c.name[s.language]}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title={t('settings.mix')} desc={t('settings.mix.desc')}>
        <MixEditor mix={s.mix} />
      </Section>

      <AddContent />

      <DataSection />

      <About />
    </div>
  )
}

// ---- sections ---------------------------------------------------------------

function VoicePicker() {
  const t = useT()
  const s = useSettings()
  const [, force] = useState(0)
  useEffect(() => onVoicesChanged(() => force((n) => n + 1)), [])
  const voices = getVoices(s.language)
  return (
    <div className="field">
      <label className="field-label" htmlFor="voice">
        {t('settings.voice')}
      </label>
      <div className="field-row">
        <select id="voice" className="select" value={s.voiceURI ?? ''} onChange={(e) => actions.updateSettings({ voiceURI: e.target.value || undefined })}>
          <option value="">{t('settings.voice.auto')}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-ghost"
          onClick={() => {
            unlockNarration()
            speak(t('settings.voice.sample'), { lang: s.language, rate: s.narrationRate, voiceURI: s.voiceURI })
          }}
        >
          <Icon name="soundOn" size={18} /> {t('settings.voice.test')}
        </button>
      </div>
    </div>
  )
}

function MixEditor({ mix }: { mix: Mix }) {
  const t = useT()
  const total = mix.preferred + mix.related + mix.discovery || 1
  const keys: (keyof Mix)[] = ['preferred', 'related', 'discovery']
  return (
    <>
      <div className="mix-bar" aria-hidden>
        {keys.map((k) => (
          <span key={k} className={`mix-${k}`} style={{ flexGrow: mix[k] }} />
        ))}
      </div>
      {keys.map((k) => (
        <Slider
          key={k}
          label={t(`settings.mix.${k}`)}
          min={0}
          max={100}
          step={5}
          value={mix[k]}
          format={(v) => `${Math.round((v / total) * 100)}%`}
          onChange={(v) => actions.updateSettings({ mix: { ...mix, [k]: v } })}
        />
      ))}
    </>
  )
}

function AddContent() {
  const t = useT()
  const s = useSettings()
  const custom = useAppState((st) => st.custom)
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [topic, setTopic] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const add = (raw: string) => {
    setErrors([])
    let data: unknown
    try {
      // Tolerate a copied markdown code fence around the JSON.
      data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''))
    } catch (e) {
      setErrors([`JSON: ${(e as Error).message}`])
      return
    }
    const items = Array.isArray(data) ? data : [data]
    const problems: string[] = []
    let last = ''
    for (const item of items) {
      const withOrigin = item && typeof item === 'object' && !('origin' in item) ? { ...item, origin: 'manual' } : item
      const r = experienceSchema.safeParse(withOrigin)
      if (!r.success) {
        problems.push(...r.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'root'}: ${i.message}`))
        continue
      }
      actions.addCustom(r.data)
      last = r.data.id
      toast(t('settings.content.added', { title: r.data.title }))
    }
    setErrors(problems)
    if (!problems.length) setText('')
    if (last && items.length === 1) navigate(hrefFor.experience(last))
  }

  const copyPrompt = async () => {
    const prompt = buildPrompt({ topic: topic.trim() || 'a surprising, well-documented idea worth knowing', language: s.language })
    try {
      await navigator.clipboard.writeText(prompt)
      toast(t('settings.prompt.copied'))
    } catch {
      setText(prompt)
    }
  }

  return (
    <>
      <Section title={t('settings.content')} desc={t('settings.content.desc')}>
        <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('settings.content.paste')} spellCheck={false} />
        {errors.length > 0 && (
          <ul className="errors">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!text.trim()} onClick={() => add(text)}>
            <Icon name="check" size={18} /> {t('settings.content.add')}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {t('settings.content.file')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) add(await f.text())
              e.target.value = ''
            }}
          />
        </div>
        {custom.length > 0 && (
          <div className="custom-list">
            <div className="field-label">{t('settings.content.yours')}</div>
            {custom.map((c) => (
              <div key={c.id} className="custom-item">
                <a href={hrefFor.experience(c.id)}>{c.title}</a>
                <button className="icon-btn" onClick={() => actions.removeCustom(c.id)} aria-label="Remove">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('settings.prompt')} desc={t('settings.prompt.desc')}>
        <div className="field-row">
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('settings.prompt.topic')} />
          <button className="btn btn-ghost" onClick={copyPrompt}>
            <Icon name="copy" size={18} /> {t('settings.prompt.copy')}
          </button>
        </div>
      </Section>
    </>
  )
}

function DataSection() {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const blob = new Blob([actions.exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smart-learning-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Section title={t('settings.data')} desc={t('settings.data.desc')}>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={exportData}>
          <Icon name="download" size={18} /> {t('settings.export')}
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} /> {t('settings.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              actions.importData(await f.text())
              toast(t('settings.imported'))
            } catch (err) {
              toast(t('settings.importFailed', { error: (err as Error).message }))
            }
          }}
        />
      </div>
      <div className="btn-row">
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm(t('settings.resetHistory.confirm'))) {
              actions.resetHistory()
              toast(t('settings.done'))
            }
          }}
        >
          <Icon name="replay" size={18} /> {t('settings.resetHistory')}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm(t('settings.resetAll.confirm'))) {
              actions.resetEverything()
              toast(t('settings.done'))
            }
          }}
        >
          <Icon name="trash" size={18} /> {t('settings.resetAll')}
        </button>
      </div>
    </Section>
  )
}

function About() {
  const t = useT()
  const library = useLibrary()
  const interactions = useAppState((s) => s.interactions)
  const all = Object.values(interactions)
  return (
    <Section title={t('settings.about')}>
      <p className="muted">{t('settings.about.text', { n: library.length })}</p>
      <p className="muted small">
        {t('settings.stats', {
          seen: all.filter((i) => i.views > 0).length,
          done: all.filter((i) => i.completions > 0).length,
          saved: all.filter((i) => i.savedAt).length,
        })}
        {' · '}
        {curated.length} curated
      </p>
    </Section>
  )
}

// ---- controls ---------------------------------------------------------------

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="set-section">
      <h2>{title}</h2>
      {desc && <p className="muted set-desc">{desc}</p>}
      <div className="set-body">{children}</div>
    </section>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider-row">
      <span className="slider-top">
        <span>{label}</span>
        <span className="slider-value">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
