export type LinkStatus = 'ok' | 'blocked' | 'broken'

export interface LinkResult {
  url: string
  status: LinkStatus
  detail: string
}

/**
 * Checks that a source URL resolves. Many publishers (Elsevier, Wiley, JSTOR…)
 * answer automated requests with 403/429 even though the page exists, so those
 * are reported as "blocked — check by hand" rather than broken.
 */
export async function checkLink(url: string, timeoutMs = 15000): Promise<LinkResult> {
  // DOIs: ask the DOI registry directly. Publishers often block bots, but the
  // registry reliably tells us whether the DOI exists — which also catches
  // DOIs an AI made up.
  const doi = url.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i)?.[1]
  if (doi) {
    try {
      const res = await fetch(`https://doi.org/api/handles/${doi}`, { signal: AbortSignal.timeout(timeoutMs) })
      const data = (await res.json()) as { responseCode?: number }
      return data.responseCode === 1
        ? { url, status: 'ok', detail: 'DOI registered' }
        : { url, status: 'broken', detail: 'DOI not found in registry' }
    } catch (e) {
      return { url, status: 'blocked', detail: `DOI registry unreachable: ${(e as Error).message}` }
    }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (personal learning app source checker)',
        accept: 'text/html,application/xhtml+xml,*/*',
      },
    })
    res.body?.cancel().catch(() => {})
    if (res.ok) return { url, status: 'ok', detail: String(res.status) }
    if ([401, 403, 405, 406, 418, 429, 503].includes(res.status)) return { url, status: 'blocked', detail: `${res.status} (bot protection?)` }
    return { url, status: 'broken', detail: String(res.status) }
  } catch (e) {
    return { url, status: 'broken', detail: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message }
  } finally {
    clearTimeout(timer)
  }
}

export async function checkLinks(urls: string[], concurrency = 6) {
  const unique = [...new Set(urls)]
  const results: LinkResult[] = []
  let i = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < unique.length) results.push(await checkLink(unique[i++]))
    }),
  )
  return new Map(results.map((r) => [r.url, r]))
}
