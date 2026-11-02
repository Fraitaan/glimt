import type { SourceDoc } from '../../src/content/prompt.ts'

/**
 * Fetches real source text before the model writes anything, so explainers are
 * summaries of material we can point to rather than things a model "remembers".
 *
 *   Wikipedia   – overview and context (any topic, en/sv)
 *   Europe PMC  – peer-reviewed abstracts (science, health, psychology, learning, money)
 *
 * Both APIs are free and need no key.
 */

// Wikimedia asks automated clients to identify themselves.
const UA = `GlimtLearningFeed/1.0 (personal learning app${process.env.RESEARCH_CONTACT ? `; ${process.env.RESEARCH_CONTACT}` : ''})`
const MAX_CHARS_PER_DOC = 6000

const RESEARCH_CATEGORIES = new Set(['science', 'health', 'psychology', 'productivity', 'money', 'ai'])

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) })
    if (res.ok) return (await res.json()) as T
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) || 5 * 2 ** attempt
      await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000))
      continue
    }
    throw new Error(`${res.status} ${url}`)
  }
}

const clip = (s: string, n = MAX_CHARS_PER_DOC) => (s.length > n ? s.slice(0, n) + ' […]' : s)
const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

interface WikiPage {
  title: string
  extract?: string
  fullurl: string
  missing?: boolean
}

export async function wikipedia(topic: string, lang: 'en' | 'sv', limit = 2): Promise<SourceDoc[]> {
  const base = `https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*`
  const fetchPages = async (titles: string[]) =>
    (
      await getJson<{ query: { pages: WikiPage[] } }>(
        `${base}&action=query&prop=extracts|info&inprop=url&explaintext=1&exsectionformat=plain&redirects=1&titles=${encodeURIComponent(titles.join('|'))}`,
      )
    ).query.pages.filter(
      (p) =>
        !p.missing &&
        p.extract &&
        p.extract.length > 300 &&
        // Skip disambiguation pages ("X may refer to…" / "X kan syfta på…").
        !/\((disambiguation|olika betydelser)\)/i.test(p.title) &&
        !/(may refer to|kan syfta på|kan avse)/i.test(p.extract.slice(0, 300)),
    )

  // An article titled exactly like the topic (following redirects) beats search ranking:
  // "placebo effect" → "Placebo", not "Nocebo".
  const exact = await fetchPages([topic.charAt(0).toUpperCase() + topic.slice(1)])
  const pages: WikiPage[] = [...exact]
  if (pages.length < limit) {
    const search = await getJson<{ query: { search: { title: string }[] } }>(
      `${base}&action=query&list=search&srlimit=${limit + 1}&srsearch=${encodeURIComponent(topic)}`,
    )
    const titles = search.query.search.map((s) => s.title).filter((t) => !pages.some((p) => p.title === t))
    if (titles.length) {
      const found = await fetchPages(titles)
      // Keep search order (the API returns pages alphabetically).
      found.sort((a, b) => titles.indexOf(a.title) - titles.indexOf(b.title))
      pages.push(...found)
    }
  }
  return pages
    .slice(0, limit)
    .map((p) => ({
      title: p.title,
      publisher: lang === 'sv' ? 'Wikipedia (svenska)' : 'Wikipedia',
      url: p.fullurl,
      text: clip(p.extract!.replace(/\n{2,}/g, '\n')),
    }))
}

interface PmcResult {
  title: string
  authorString?: string
  pubYear?: string
  doi?: string
  pmid?: string
  abstractText?: string
  journalInfo?: { journal?: { title?: string } }
}

export async function europePmc(topic: string, limit = 2): Promise<SourceDoc[]> {
  // Reviews whose title matches the topic, most cited first: foundational
  // overviews of a field rather than one narrow recent study.
  const terms = topic.replace(/\(.*?\)/g, '').replace(/["()]/g, '').trim()
  const search = async (title: string) =>
    (
      await getJson<{ resultList: { result: PmcResult[] } }>(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=${limit}&sort=${encodeURIComponent('CITED desc')}&query=${encodeURIComponent(
          `TITLE:${title} AND HAS_ABSTRACT:y AND (PUB_TYPE:"review" OR PUB_TYPE:"systematic-review")`,
        )}`,
      )
    ).resultList.result
  let results = await search(`"${terms}"`)
  if (!results.length) results = await search(`(${terms})`)
  return results
    .filter((r) => r.abstractText && (r.doi || r.pmid))
    .map((r) => {
      const firstAuthor = r.authorString?.split(',')[0]?.replace(/\.$/, '')
      const journal = r.journalInfo?.journal?.title ?? 'Europe PMC'
      return {
        title: stripTags(r.title).replace(/\.$/, ''),
        publisher: firstAuthor ? `${journal} (${firstAuthor} et al.)` : journal,
        url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/MED/${r.pmid}`,
        year: r.pubYear ? Number(r.pubYear) : undefined,
        text: clip(stripTags(r.abstractText!), 3000),
      }
    })
}

/** Today's featured Wikipedia article: a fallback topic when the queue is empty. */
export async function featuredTopic(): Promise<string | undefined> {
  const d = new Date()
  const ymd = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
  try {
    const feed = await getJson<{ tfa?: { titles?: { normalized?: string } } }>(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${ymd}`)
    return feed.tfa?.titles?.normalized
  } catch {
    return undefined
  }
}

export async function research(topic: string, lang: 'en' | 'sv', category?: string): Promise<SourceDoc[]> {
  const jobs: Promise<SourceDoc[]>[] = [wikipedia(topic, lang)]
  // Swedish Wikipedia is thinner; add English context for Swedish topics too.
  if (lang === 'sv') jobs.push(wikipedia(topic, 'en', 1))
  if (lang === 'en' && (!category || RESEARCH_CATEGORIES.has(category))) jobs.push(europePmc(topic))
  const results = await Promise.allSettled(jobs)
  for (const r of results) if (r.status === 'rejected') console.log(`  ! source lookup failed: ${(r.reason as Error).message.slice(0, 120)}`)
  const docs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  const seen = new Set<string>()
  return docs.filter((d) => !seen.has(d.url) && seen.add(d.url))
}
