/**
 * Validates every experience in content/experiences (and content/drafts with --drafts).
 * Runs automatically before `npm run build`, so broken content can never be published.
 *
 *   npm run validate
 *   npm run validate -- --drafts
 */
import { checkFile, jsonFiles, LIBRARY_DIR, DRAFTS_DIR, type CheckResult } from './lib/content-files.ts'

const includeDrafts = process.argv.includes('--drafts')
const files = [...jsonFiles(LIBRARY_DIR), ...(includeDrafts ? jsonFiles(DRAFTS_DIR) : [])]
const results: CheckResult[] = files.map(checkFile)

const ids = new Map<string, string>()
for (const r of results) {
  if (!r.experience) continue
  const prev = ids.get(r.experience.id)
  if (prev) r.errors.push(`duplicate id "${r.experience.id}" (also in ${prev})`)
  ids.set(r.experience.id, r.file)
}
for (const r of results) {
  const t = r.experience?.translationOf
  if (t && !ids.has(t)) r.errors.push(`translationOf "${t}" does not match any experience`)
}

let errorCount = 0
for (const r of results) {
  if (!r.errors.length && !r.warnings.length) continue
  console.log(`\n${r.errors.length ? '✗' : '!'} ${r.file}`)
  r.errors.forEach((e) => console.log(`   error   ${e}`))
  r.warnings.forEach((w) => console.log(`   warning ${w}`))
  errorCount += r.errors.length
}

const ok = results.filter((r) => !r.errors.length).length
console.log(`\n${ok}/${results.length} experiences valid${errorCount ? `, ${errorCount} error(s)` : ''}.`)
if (errorCount) process.exit(1)
