/**
 * Pre-generated narration clips are looked up by what is said, not by which
 * explainer or scene says it, so editing one scene only re-records that line.
 * Shared by the browser (lookup) and scripts/narrate.ts (generation).
 */

// cyrb53: small, fast, good enough to tell sentences apart.
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Key in content/narration.json for a spoken line. */
export const narrationKey = (lang: string, text: string) => cyrb53(`${lang}|${normalize(text)}`)

/** File name of a clip; includes the voice so switching voices re-records everything. */
export const narrationFile = (voice: string, lang: string, text: string) => `${cyrb53(`${voice}|${lang}|${normalize(text)}`)}.mp3`
