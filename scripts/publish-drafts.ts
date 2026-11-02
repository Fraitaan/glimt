/**
 * Moves valid drafts from content/drafts/ into the library (content/experiences/).
 * Invalid drafts stay put and are reported. Rebuild/deploy afterwards to publish.
 *
 *   npm run publish-drafts            (all valid drafts)
 *   npm run publish-drafts -- my-id   (only the named drafts)
 */
import { renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { checkFile, jsonFiles, DRAFTS_DIR, LIBRARY_DIR } from './lib/content-files.ts'

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const drafts = jsonFiles(DRAFTS_DIR).filter((f) => !only.length || only.some((id) => f.endsWith(`${id}.json`)))

if (!drafts.length) console.log('No drafts to publish.')
for (const file of drafts) {
  const r = checkFile(file)
  if (r.errors.length || !r.experience) {
    console.log(`✗ ${r.file} — not published:`)
    r.errors.forEach((e) => console.log(`   ${e}`))
    continue
  }
  const target = join(LIBRARY_DIR, `${r.experience.id}.json`)
  if (existsSync(target)) {
    console.log(`✗ ${r.file} — ${r.experience.id}.json already exists in the library`)
    continue
  }
  renameSync(file, target)
  console.log(`✓ ${r.experience.id} → content/experiences/`)
}
console.log('\nNext: npm run build (or push to your host) to publish.')
