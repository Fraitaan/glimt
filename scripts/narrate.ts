/**
 * Records natural-sounding narration for the library with free, open-source
 * neural voices that run locally (no API, no key, no cost):
 *
 *   English  – Kokoro-82M (Apache-2.0), via kokoro-js
 *   Swedish  – Piper (sv_SE voices), via the piper-tts Python package
 *
 * Clips go to public/narration/<hash>.mp3 and the lookup table to
 * content/narration.json (bundled into the app). Lines that already have a clip
 * are skipped, so re-running only records what's new or edited. Explainers
 * without a clip (e.g. added in Settings) fall back to the device's voices.
 *
 *   npm run narrate                 (record everything missing)
 *   npm run narrate -- --dry        (only list what's missing)
 *
 * Swedish needs Python 3 with `pip install piper-tts`.
 * Voices: NARRATION_VOICE_EN (default af_heart), NARRATION_VOICE_SV (default sv_SE-lisa-medium).
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { checkFile, jsonFiles, LIBRARY_DIR, ROOT } from './lib/content-files.ts'
import { beatsFor } from '../src/scenes/beats.ts'
import { narrationFile, narrationKey } from '../src/lib/narrationKey.ts'

const AUDIO_DIR = join(ROOT, 'public/narration')
const INDEX_FILE = join(ROOT, 'content/narration.json')
const VOICE_DIR = join(ROOT, '.voices')
const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')

const VOICES = {
  en: { engine: 'kokoro', name: process.env.NARRATION_VOICE_EN ?? 'af_heart' },
  sv: { engine: 'piper', name: process.env.NARRATION_VOICE_SV ?? 'sv_SE-lisa-medium' },
} as const
type Lang = keyof typeof VOICES
const voiceId = (lang: Lang) => `${VOICES[lang].engine}:${VOICES[lang].name}`

// Also spoken outside the feed: the "Test voice" button in Settings (see src/i18n.ts).
const EXTRA_LINES: [Lang, string][] = [
  ['en', 'This is how your narrator sounds.'],
  ['sv', 'Så här låter din uppläsare.'],
]

const dry = process.argv.includes('--dry')

// ---- collect every line the app can say ------------------------------------

const lines = new Map<string, { lang: Lang; text: string; file: string }>()
const add = (lang: Lang, text: string) => {
  if (!text.trim()) return
  lines.set(narrationKey(lang, text), { lang, text, file: narrationFile(voiceId(lang), lang, text) })
}
for (const path of jsonFiles(LIBRARY_DIR)) {
  const exp = checkFile(path).experience
  if (!exp) continue
  for (const scene of exp.scenes) for (const beat of beatsFor(scene)) add(exp.language, beat.say)
}
for (const [lang, text] of EXTRA_LINES) add(lang, text)

mkdirSync(AUDIO_DIR, { recursive: true })
const missing = [...lines.values()].filter((l) => !existsSync(join(AUDIO_DIR, l.file)))
console.log(`${lines.size} lines, ${lines.size - missing.length} already recorded, ${missing.length} to record.`)
if (dry) {
  missing.forEach((l) => console.log(`  [${l.lang}] ${l.text.slice(0, 90)}`))
  process.exit(0)
}

// ---- engines -----------------------------------------------------------------

let kokoro: import('kokoro-js').KokoroTTS | undefined
async function kokoroWav(text: string, out: string) {
  if (!kokoro) {
    const { KokoroTTS } = await import('kokoro-js')
    kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' })
  }
  const audio = await kokoro.generate(text, { voice: VOICES.en.name as 'af_heart' })
  await audio.save(out)
}

function run(cmd: string, args: string[], input?: string) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}: ${(r.stderr || '').trim().split('\n').pop()}`)
}

function piperWav(text: string, out: string) {
  const model = join(VOICE_DIR, `${VOICES.sv.name}.onnx`)
  if (!existsSync(model)) run(PYTHON, ['-m', 'piper.download_voices', '--data-dir', VOICE_DIR, VOICES.sv.name])
  // Piper produces no audio for some lines wrapped in typographic quotes; they aren't spoken anyway.
  run(PYTHON, ['-m', 'piper', '-m', model, '-f', out], text.replace(/[“”„«»"]/g, ''))
}

function toMp3(wav: string, mp3: string) {
  // Speech in mono at 48 kbps: ~6 KB per second, plenty for a voice.
  run(ffmpegPath as unknown as string, ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '24000', '-b:a', '48k', mp3])
}

// ---- record ------------------------------------------------------------------

const tmp = mkdtempSync(join(tmpdir(), 'glimt-narrate-'))
let failed = 0
try {
  for (const [i, line] of missing.entries()) {
    const wav = join(tmp, 'clip.wav')
    process.stdout.write(`[${i + 1}/${missing.length}] ${line.lang} ${line.text.slice(0, 60)}… `)
    try {
      if (VOICES[line.lang].engine === 'kokoro') await kokoroWav(line.text, wav)
      else piperWav(line.text, wav)
      toMp3(wav, join(AUDIO_DIR, line.file))
      console.log('✓')
    } catch (e) {
      failed++
      console.log(`✗ ${(e as Error).message}`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// ---- index + cleanup ---------------------------------------------------------

const index: Record<string, string> = {}
for (const [key, line] of [...lines].sort(([a], [b]) => a.localeCompare(b)))
  if (existsSync(join(AUDIO_DIR, line.file))) index[key] = line.file
writeFileSync(INDEX_FILE, JSON.stringify(index, null, 1) + '\n')

// Clips no line uses any more (edited text, deleted explainer, changed voice).
const used = new Set(Object.values(index))
const orphans = readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.mp3') && !used.has(f))
orphans.forEach((f) => rmSync(join(AUDIO_DIR, f)))

console.log(`\n${Object.keys(index).length}/${lines.size} lines have a clip.${orphans.length ? ` Removed ${orphans.length} unused clips.` : ''}`)
if (failed) {
  console.log(`${failed} failed — those lines use the device voice until the next run.`)
  process.exitCode = 1
}
