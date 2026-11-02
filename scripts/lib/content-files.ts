import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { experienceSchema, lintExperience, type Experience } from '../../src/content/schema.ts'

export const ROOT = resolve(import.meta.dirname, '../..')
export const LIBRARY_DIR = join(ROOT, 'content/experiences')
export const DRAFTS_DIR = join(ROOT, 'content/drafts')

export interface CheckResult {
  file: string
  experience?: Experience
  errors: string[]
  warnings: string[]
}

export function checkFile(path: string): CheckResult {
  const file = path.split(/[\\/]/).pop()!
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return { file, errors: [`invalid JSON: ${(e as Error).message}`], warnings: [] }
  }
  return checkData(raw, file)
}

export function checkData(raw: unknown, file: string): CheckResult {
  const parsed = experienceSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      file,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      warnings: [],
    }
  }
  const errors: string[] = []
  if (file.endsWith('.json') && file !== `${parsed.data.id}.json`) errors.push(`file name should be ${parsed.data.id}.json`)
  return { file, experience: parsed.data, errors, warnings: lintExperience(parsed.data) }
}

export function jsonFiles(dir: string) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f))
  } catch {
    return []
  }
}
