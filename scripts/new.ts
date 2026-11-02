/**
 * Scaffolds a new hand-written experience in content/drafts/.
 *
 *   npm run new -- my-topic-id --category science
 */
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { DRAFTS_DIR } from './lib/content-files.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { category: { type: 'string', default: 'curiosities' }, lang: { type: 'string', default: 'en' } },
})
const id = positionals[0]
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.log('Usage: npm run new -- my-topic-id [--category science] [--lang sv]')
  process.exit(1)
}

const file = join(DRAFTS_DIR, `${id}.json`)
if (existsSync(file)) {
  console.log(`${file} already exists`)
  process.exit(1)
}

const template = {
  id,
  title: 'A short, intriguing, honest title',
  category: values.category,
  language: values.lang,
  summary: 'One or two sentences that capture the idea.',
  evidence: 'established',
  evidenceNote: 'Optional: what is uncertain or simplified.',
  scenes: [
    { role: 'hook', template: 'kinetic', text: 'A surprising opening line.', emphasis: ['surprising'], duration: 5 },
    { role: 'explanation', template: 'illustration', visual: 'lightbulb', text: 'What is actually going on, in plain words.', duration: 8 },
    { role: 'fact', template: 'stat', value: 42, suffix: '%', text: 'What the number means — only use numbers from your sources.', duration: 8 },
    { role: 'example', template: 'comparison', text: 'A concrete contrast.', left: { label: 'Before', text: '…' }, right: { label: 'After', text: '…' }, duration: 9 },
    { role: 'insight', template: 'reveal', text: 'Set up the twist…', reveal: '…and pay it off.', duration: 9 },
    { role: 'takeaway', template: 'kinetic', text: 'One sentence worth remembering.', duration: 5 },
  ],
  sources: [{ title: 'Source title', publisher: 'Publisher or journal', url: 'https://doi.org/…', year: 2020 }],
  tags: ['tag'],
  origin: 'manual',
}

writeFileSync(file, JSON.stringify(template, null, 2) + '\n')
console.log(`Created ${file}
Edit it, preview with "npm run dev" after "npm run publish-drafts -- ${id}", or paste it into Settings → Add content.`)
