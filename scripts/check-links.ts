/**
 * Verifies that every source URL in the library (or drafts) still resolves.
 *
 *   npm run check-links
 *   npm run check-links -- --drafts
 */
import { checkFile, jsonFiles, LIBRARY_DIR, DRAFTS_DIR } from './lib/content-files.ts'
import { checkLinks } from './lib/links.ts'

const dir = process.argv.includes('--drafts') ? DRAFTS_DIR : LIBRARY_DIR
const experiences = jsonFiles(dir).flatMap((f) => checkFile(f).experience ?? [])
const urls = experiences.flatMap((e) => e.sources.map((s) => s.url))
console.log(`Checking ${new Set(urls).size} source links…`)

const results = await checkLinks(urls)
let broken = 0
for (const e of experiences) {
  for (const s of e.sources) {
    const r = results.get(s.url)!
    if (r.status === 'ok') continue
    if (r.status === 'broken') broken++
    console.log(`${r.status === 'broken' ? '✗' : '?'} ${e.id}: ${s.url} — ${r.status} ${r.detail}`)
  }
}
const ok = [...results.values()].filter((r) => r.status === 'ok').length
console.log(`\n${ok}/${results.size} ok, ${broken} broken. "?" = publisher blocks bots; open it in a browser to confirm.`)
if (broken) process.exit(1)
