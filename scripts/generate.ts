/**
 * OPTIONAL AI-assisted content generation. Runs locally or in GitHub Actions — never in the website.
 *
 *   npm run generate -- "why we yawn"
 *   npm run generate -- "why we yawn" --category health --lang sv
 *   npm run generate -- --batch topics.txt          (one topic per line)
 *   npm run generate -- --from-queue 3              (take the next 3 topics from content/topics.txt)
 *   npm run generate -- "why we yawn" --provider manual
 *
 * Before writing, the script fetches real source text (Wikipedia, Europe PMC)
 * and the model may only use and cite that material. Drafts citing anything
 * else are rejected. Pass --no-research to let the model pick sources itself.
 *
 * Providers (set AI_PROVIDER in .env or pass --provider):
 *   manual    – writes the prompt to a file; paste it into any AI chat (free), save the answer
 *   openai    – any OpenAI-compatible endpoint: Gemini (free tier), Groq, OpenRouter,
 *               a local Ollama server, or OpenAI — via OPENAI_BASE_URL / OPENAI_MODEL / OPENAI_API_KEY
 *   anthropic – Claude API (paid per use; needs ANTHROPIC_API_KEY)
 *
 * Output goes to content/drafts/ for review. Nothing is published until
 * `npm run publish-drafts` (or merging the automated pull request).
 */
import { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { buildPrompt, type SourceDoc } from '../src/content/prompt.ts'
import { CATEGORY_IDS } from '../src/content/categories.ts'
import { checkData, DRAFTS_DIR, LIBRARY_DIR, ROOT } from './lib/content-files.ts'
import { checkLinks } from './lib/links.ts'
import { featuredTopic, research } from './lib/sources.ts'

try {
  process.loadEnvFile(join(ROOT, '.env'))
} catch {
  // no .env — fine, defaults below
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: 'string' },
    lang: { type: 'string', default: 'en' },
    provider: { type: 'string', default: process.env.AI_PROVIDER ?? 'manual' },
    batch: { type: 'string' },
    'from-queue': { type: 'string' },
    'no-research': { type: 'boolean', default: false },
    'no-link-check': { type: 'boolean', default: false },
    report: { type: 'string' },
    /** Seconds between model calls, to stay inside free-tier rate limits. */
    delay: { type: 'string', default: '15' },
  },
})

interface Job {
  topic: string
  category?: string
  lang: 'en' | 'sv'
}

const QUEUE = join(ROOT, 'content/topics.txt')
const asLang = (s?: string): 'en' | 'sv' => (s?.trim() === 'sv' ? 'sv' : 'en')
const asCategory = (s?: string) => ((CATEGORY_IDS as readonly string[]).includes(s?.trim() ?? '') ? s!.trim() : undefined)

/** Lines look like:  why we yawn | health | en   (category and language optional, # = comment) */
function parseLine(line: string): Job {
  const [topic, category, lang] = line.split('|').map((s) => s.trim())
  return { topic, category: asCategory(category), lang: asLang(lang) }
}

const isTopicLine = (l: string) => !!l.trim() && !l.trim().startsWith('#')

async function collectJobs(): Promise<Job[]> {
  if (values['from-queue']) {
    const n = Math.max(1, Number(values['from-queue']) || 1)
    const lines = existsSync(QUEUE) ? readFileSync(QUEUE, 'utf8').split(/\r?\n/) : []
    const jobs: Job[] = []
    const rest: string[] = []
    for (const line of lines) {
      if (jobs.length < n && isTopicLine(line)) jobs.push(parseLine(line))
      else rest.push(line)
    }
    // Remove the taken topics so the next run continues where this one stopped.
    if (jobs.length) writeFileSync(QUEUE, rest.join('\n'))
    if (!jobs.length) {
      const featured = await featuredTopic()
      if (featured) {
        console.log(`Topic queue is empty — using today's featured Wikipedia article: ${featured}`)
        jobs.push({ topic: featured, lang: 'en' })
      }
    }
    return jobs
  }
  if (values.batch) return readFileSync(values.batch, 'utf8').split(/\r?\n/).filter(isTopicLine).map(parseLine)
  if (positionals.length) return [{ topic: positionals.join(' '), category: asCategory(values.category), lang: asLang(values.lang) }]
  return []
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const normUrl = (u: string) => u.trim().replace(/^http:/, 'https:').replace(/\/$/, '').toLowerCase()

// ---- providers ----------------------------------------------------------------

class RetryableError extends Error {}

async function callAnthropic(prompt: string): Promise<string> {
  // Imported lazily so the other modes work without any Anthropic setup.
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const response = await client.beta.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    max_tokens: 16000,
    output_config: { effort: 'high' },
    // If the main model declines, the API retries on a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  } as Parameters<typeof client.beta.messages.create>[0] & { stream?: false })
  if (response.stop_reason === 'refusal') throw new Error('The model declined this topic.')
  if (response.stop_reason === 'max_tokens') throw new Error('Response was cut off (max_tokens).')
  return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
}

const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const openAIAuth: Record<string, string> = process.env.OPENAI_API_KEY ? { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}

/**
 * Models to try, in order: OPENAI_MODEL (comma-separated), then, with
 * OPENAI_FALLBACK=auto, a few other "flash" models the key can use. Free tiers
 * are often briefly overloaded (503), and a sibling model usually still answers.
 */
let modelList: Promise<string[]> | undefined
function openAIModels() {
  return (modelList ??= (async () => {
    const primary = (process.env.OPENAI_MODEL || 'gpt-4o-mini').split(',').map((m) => m.trim()).filter(Boolean)
    if (process.env.OPENAI_FALLBACK !== 'auto') return primary
    try {
      const res = await fetch(`${OPENAI_BASE}/models`, { headers: openAIAuth, signal: AbortSignal.timeout(20000) })
      const ids = ((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id.replace(/^models\//, '')) ?? []
      const extra = ids
        .filter((id) => /flash/i.test(id) && !/image|tts|live|audio|embed|exp|preview/i.test(id) && !primary.includes(id))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .slice(0, 3)
      if (extra.length) console.log(`Fallback models: ${extra.join(', ')}`)
      return [...primary, ...extra]
    } catch {
      return primary
    }
  })())
}

async function callOpenAICompatible(prompt: string, model: string): Promise<string> {
  const started = Date.now()
  let res: Response
  try {
    res = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...openAIAuth },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        // Summarising given sources needs little deliberation, and reasoning models
        // that "think" at full depth by default can take minutes. Only sent when set,
        // since not every OpenAI-compatible server accepts it.
        ...(process.env.OPENAI_REASONING_EFFORT ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(150000),
    })
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new RetryableError('no response within 150 s')
    throw e
  }
  console.log(`  ${model} answered in ${Math.round((Date.now() - started) / 1000)}s (HTTP ${res.status})`)
  if (res.status === 429 || res.status >= 500) throw new RetryableError(`${res.status} ${(await res.text()).slice(0, 300)}`)
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 500)}`)
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

async function callModel(prompt: string): Promise<string> {
  const attempts: [string, (p: string) => Promise<string>][] =
    values.provider === 'anthropic'
      ? [['claude', callAnthropic]]
      : (await openAIModels()).map((m) => [m, (p: string) => callOpenAICompatible(p, m)])
  let last: unknown
  for (const [name, call] of attempts) {
    for (const wait of [0, 30]) {
      if (wait) {
        console.log(`  … ${name} busy, retrying in ${wait}s`)
        await sleep(wait * 1000)
      }
      try {
        return await call(prompt)
      } catch (e) {
        if (!(e instanceof RetryableError)) throw e
        last = e
        console.log(`  ! ${name}: ${(e as Error).message.slice(0, 120)}`)
      }
    }
  }
  throw last
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('No JSON object found in the response')
  return JSON.parse(text.slice(start, end + 1))
}

// ---- main ---------------------------------------------------------------------

const jobs = await collectJobs()
if (!jobs.length) {
  console.log('Usage: npm run generate -- "topic" [--category health] [--lang sv] [--provider manual|openai|anthropic]')
  console.log('       npm run generate -- --from-queue 3      (uses content/topics.txt)')
  process.exit(values['from-queue'] ? 0 : 1)
}

const report: string[] = []
let produced = 0

for (const [i, job] of jobs.entries()) {
  console.log(`\n▶ ${job.topic}${job.category ? ` (${job.category})` : ''} [${job.lang}]`)
  if (i > 0 && values.provider !== 'manual') await sleep(Number(values.delay) * 1000)

  let sources: SourceDoc[] = []
  if (!values['no-research']) {
    sources = await research(job.topic, job.lang, job.category)
    console.log(`  found ${sources.length} source(s): ${sources.map((s) => s.publisher).join(', ') || '—'}`)
    if (!sources.length) {
      console.log('  ✗ no source material found — skipping (rephrase the topic, or use --no-research)')
      report.push(`### ✗ ${job.topic}\nNo source material found, so nothing was generated. Rephrase the topic in \`content/topics.txt\` and it will be picked up next time.\n`)
      continue
    }
  }

  const prompt = buildPrompt({ topic: job.topic, category: job.category, language: job.lang, sources })

  if (values.provider === 'manual') {
    const file = join(DRAFTS_DIR, `_prompt-${slug(job.topic)}.txt`)
    writeFileSync(file, prompt)
    console.log(`  Prompt saved to ${file}
  1. Paste it into any AI chat (ChatGPT, Claude, Gemini… free tiers work).
  2. Save the JSON answer as content/drafts/<id>.json
  3. Review it and check the sources, then: npm run publish-drafts
  (Or paste the JSON into the app under Settings → Add content to try it on your phone.)`)
    continue
  }

  let raw: unknown
  try {
    raw = extractJson(await callModel(prompt))
  } catch (e) {
    console.log(`  ✗ generation failed: ${(e as Error).message}`)
    // Put the topic back at the end of the queue so an outage doesn't lose it.
    if (values['from-queue']) appendFileSync(QUEUE, `\n${[job.topic, job.category ?? '', job.lang].join(' | ')}`)
    report.push(`### ✗ ${job.topic}\nGeneration failed (topic put back in the queue): \`${(e as Error).message.slice(0, 200)}\`\n`)
    continue
  }

  const id = (raw as { id?: string })?.id ?? slug(job.topic)
  const result = checkData({ origin: 'generated', ...(raw as object) }, `${id}.json`)
  const exp = result.experience

  // The model may only cite what it was given.
  if (exp && sources.length) {
    const allowed = new Set(sources.map((s) => normUrl(s.url)))
    for (const s of exp.sources) if (!allowed.has(normUrl(s.url))) result.errors.push(`cites a source it was not given: ${s.url}`)
  }
  if (exp && existsSync(join(LIBRARY_DIR, `${exp.id}.json`))) result.errors.push(`id "${exp.id}" already exists in the library`)

  // Rejected drafts go in a subfolder that publish-drafts never reads.
  const rejected = result.errors.length > 0
  const dir = rejected ? join(DRAFTS_DIR, 'rejected') : DRAFTS_DIR
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.json`)
  writeFileSync(file, JSON.stringify({ origin: 'generated', ...(raw as object) }, null, 2) + '\n')

  const lines: string[] = []
  if (rejected) {
    console.log(`  ✗ rejected, saved to ${file}:`)
    result.errors.forEach((e) => console.log(`    ${e}`))
    lines.push(`### ✗ ${exp?.title ?? job.topic}`, `Not published — kept in \`content/drafts/rejected/${id}.json\`. Fix it and move it to \`content/drafts/\`, or delete it:`, ...result.errors.map((e) => `- ${e}`))
  } else if (exp) {
    produced++
    lines.push(`### ✓ ${exp.title}`, `\`${exp.id}\` · ${exp.category} · ${exp.language} · evidence: **${exp.evidence}**`, '', `> ${exp.summary}`, '')
    if (exp.evidenceNote) lines.push(`*Caveat:* ${exp.evidenceNote}`, '')
    lines.push('**Script**', ...exp.scenes.map((s, n) => `${n + 1}. *${s.template}* — ${s.text}${'answer' in s ? ` → ${s.answer}` : ''}${'reveal' in s ? ` → ${s.reveal}` : ''}`), '')
    const links = values['no-link-check'] ? undefined : await checkLinks(exp.sources.map((s) => s.url))
    lines.push('**Sources**')
    for (const s of exp.sources) {
      const r = links?.get(s.url)
      const mark = !r ? '' : r.status === 'ok' ? '✓ ' : r.status === 'blocked' ? '? ' : '✗ '
      lines.push(`- ${mark}[${s.title}](${s.url}) — ${s.publisher}${s.year ? `, ${s.year}` : ''}`)
      console.log(`  ${mark || '· '}source ${s.url}${r ? ` (${r.detail})` : ''}`)
    }
    if (result.warnings.length) lines.push('', '**Warnings**', ...result.warnings.map((w) => `- ${w}`))
    result.warnings.forEach((w) => console.log(`  ! ${w}`))
    console.log(`  ✓ draft saved: ${file}`)
  }
  report.push(lines.join('\n') + '\n')
}

if (values.report) {
  const header = [
    `## ${produced} new explainer${produced === 1 ? '' : 's'}`,
    '',
    'Generated from fetched source material. Before merging, for each one:',
    '- [ ] Do the claims actually match the linked sources?',
    '- [ ] Are numbers exact and the evidence level honest?',
    '- [ ] Is it worth five minutes of your day?',
    '',
    'Edit or delete files in this PR as needed. **Merging publishes them.**',
    '',
    '---',
    '',
  ]
  writeFileSync(values.report, header.join('\n') + report.join('\n'))
  console.log(`\nReport written to ${values.report}`)
}
