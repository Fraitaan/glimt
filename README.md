# Glimt — a personal learning feed

A mobile-first, TikTok-style vertical feed where every item is a short, sourced explainer that plays like an animated video — built entirely in the browser, with no video files, no backend and no required API.

- **25 curated explainers** (plus 2 Swedish translations) across 10 topics, every one with real sources and an honest evidence label (*Well established*, *Good evidence*, *Debated*, *Historical record*, *Idea / framework*, *Simplified*).
- **8 scene templates**: kinetic typography, illustration, comparison, timeline, animated statistic, breakdown, question → answer, and surprising reveal — with 28 animated line illustrations.
- **Swipe** between explainers, **tap** to pause, **tap the edges** to skip scenes, replay, save, like / "less like this", read mode with full transcript and sources.
- **Optional narration** with the device's built-in voices (free, offline).
- **Lightweight personalization** (default 60% interests / 25% related / 15% discovery, adjustable), all stored on your device.
- **English and Swedish UI**, reduced-motion support, installable as a PWA, works offline after the first visit.

---

## Run it

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173 — also printed as a LAN address for your phone
```

To try it on your phone during development, open the *Network* URL Vite prints (phone and computer on the same Wi-Fi).

```bash
npm run build        # validates content, type-checks, builds to dist/
npm run preview      # serve the production build locally
```

## Deploy (free)

The build is plain static files in `dist/`. Hash-based routing means no server rewrite rules are needed anywhere.

**Cloudflare Pages** (recommended — free, fast, unlimited bandwidth on the free plan)
1. Push the project to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command `npm run build`, output directory `dist`. Deploy.

**GitHub Pages**
1. Push to a GitHub repo, then Settings → Pages → Source: **GitHub Actions**.
2. The included workflow (`.github/workflows/deploy.yml`) builds and deploys on every push to `main`.

Either way you get an HTTPS URL. On iPhone: open it in Safari → Share → *Add to Home Screen*. On Android: Chrome menu → *Install app*.

## Using it

| Action | Touch | Keyboard |
| --- | --- | --- |
| Next / previous explainer | Swipe up / down | ↓ / ↑ (or J / K) |
| Pause / resume | Tap the middle | Space |
| Next / previous scene | Tap right / left edge, or a progress segment | → / ← |
| Replay | ↻ top right, or the end card | R |
| Save | Bookmark on the right | S |
| Switch topic | "For you ▾" pill | — |
| Read the text + sources | "Read" or the evidence/sources chips | — |

**Explore** lets you jump into a topic or tap ♥ to add it to your interests. **Saved** keeps your bookmarks. **Settings** covers language, narration, animation level, interests, feed mix, adding content and exporting/importing your data.

Your data (history, likes, saves, settings, added content) lives only in this browser's `localStorage`. Use **Settings → Export** to move it to another device and **Import** there.

---

## Adding content

Every explainer is one JSON file in `content/experiences/`. They're bundled at build time and validated against the schema in `src/content/schema.ts` — the build fails if anything is invalid, so broken content can't be published.

### Option 1 — on your phone, no tools (free)
1. **Settings → Generate with any AI chat**: type a topic, tap *Copy prompt*.
2. Paste it into any AI chat (free tiers of ChatGPT, Claude, Gemini, etc. are fine).
3. Copy the JSON answer back into **Settings → Add content** → *Validate & add*.

It's validated immediately and appears in your feed on that device (and is included in exports). **Check the sources before trusting it** — see *Accuracy* below.

### Option 2 — permanently, in the library
```bash
npm run new -- why-we-yawn --category health   # scaffold content/drafts/why-we-yawn.json
# …edit the draft…
npm run validate -- --drafts                   # schema + timing checks
npm run check-links -- --drafts                # do the sources resolve?
npm run publish-drafts                         # move valid drafts into content/experiences/
npm run build                                  # or just push — your host rebuilds
```

You can also drop any valid JSON file straight into `content/experiences/` (file name = `id` + `.json`).

### Option 3 — automated weekly content (free)

`.github/workflows/generate-content.yml` runs every Monday and opens a pull request with new explainers. Nothing is published until you merge it.

How it works:
1. Takes the next 3 topics from `content/topics.txt` (format `topic | category | language`). When the queue is empty it uses Wikipedia's featured article of the day.
2. **Fetches real source text first**: Wikipedia (en/sv) plus peer-reviewed review articles from Europe PMC for science, health, psychology, learning, money and AI topics.
3. A free model (Gemini by default) writes the explainer **only from that material**. Drafts that cite anything they weren't given are rejected into `content/drafts/rejected/`.
4. Validates the schema, checks every link (DOIs against the DOI registry) and builds the site.
5. Opens a PR whose description shows each script, its sources and any warnings. Review it on your phone, edit or delete files if needed, and merge. The deploy workflow then publishes.

One-time setup:
1. Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. GitHub repo → Settings → Secrets and variables → Actions → **New repository secret** `AI_API_KEY`.
3. Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests**.
4. Optional: run it now from the Actions tab (*Generate new explainers* → *Run workflow*) and pick how many topics.

Optional repository variables: `AI_MODEL` (default `gemini-3.8-flash`) and `AI_BASE_URL` (to switch to another OpenAI-compatible provider such as Groq or OpenRouter). Free-tier limits and model names change — check them in AI Studio. On free tiers Google may use prompts to improve its products, which is fine here since everything is public material.

Cost: 0 kr. GitHub Actions minutes are free for public repos and the private-repo free quota is far more than this needs. The job does not use Claude at all.

Add topics any time by editing `content/topics.txt` (also possible from the GitHub app). Failed generations put their topic back in the queue.

### Option 4 — run the generator yourself

`npm run generate` runs **locally** — API keys stay on your machine and are never part of the website.

```bash
cp .env.example .env              # choose a provider
npm run generate -- "why we yawn" --category health
npm run generate -- "varför vi gäspar" --lang sv
npm run generate -- --batch topics.txt        # one topic per line
npm run generate -- --from-queue 3            # same as the weekly job
npm run generate -- "why we yawn" --no-research   # let the model choose sources itself (less safe)
```

| `AI_PROVIDER` | What it does | Cost |
| --- | --- | --- |
| `manual` (default) | Saves the prompt to `content/drafts/_prompt-*.txt` for you to paste into any chat | Free |
| `openai` | Any OpenAI-compatible API: a **local [Ollama](https://ollama.com) model** (free), Groq / OpenRouter / Gemini free tiers, or OpenAI | Free → a few öre per explainer |
| `anthropic` | Claude API via the official SDK (default model `claude-opus-5-5`, set `ANTHROPIC_MODEL` to change; refusal fallback enabled) | Roughly $0.05–0.20 per explainer at Opus 5.5 rates (cheaper with `ANTHROPIC_MODEL=claude-haiku-5-5`) |

The pipeline: topic → **fetch source text** (Wikipedia, Europe PMC) → prompt (write only from that material, 5–7 scenes, pick templates) → model → JSON extraction → **schema validation** → **source check** (only provided sources allowed; DOIs verified against the DOI registry) → draft in `content/drafts/` → **you review** → `npm run publish-drafts`.

> **Development-time vs. scheduled generation.** The initial library was written during development with Claude Code; that's a one-off. Ongoing generation is the weekly GitHub Actions job above, using a free model — it never uses Claude. Every batch still waits for your review in a pull request; keeping a human in the loop is deliberate.

### Content format (short version)

```jsonc
{
  "id": "why-we-yawn",              // lowercase-dashes, must match the file name
  "title": "…", "category": "health", "language": "en",
  "summary": "…",
  "evidence": "supported",          // established | supported | debated | historical | concept | simplified
  "evidenceNote": "What's uncertain…",
  "scenes": [
    { "role": "hook", "template": "kinetic", "text": "…", "emphasis": ["word"], "duration": 5 },
    { "role": "fact", "template": "stat", "value": 38, "suffix": " μs", "text": "…", "duration": 7 }
    // templates: kinetic, illustration(visual), comparison(left,right), timeline(events),
    //            stat(value,prefix,suffix,decimals), breakdown(items), question(answer), reveal(reveal,visual?)
  ],
  "sources": [{ "title": "…", "publisher": "…", "url": "https://doi.org/…", "year": 2020 }],
  "tags": ["sleep"]
}
```

Durations are minimums: the player automatically extends any scene that has more text than its duration allows, and waits for narration to finish. Available illustrations are listed in `src/content/illustrationKeys.ts`. For a Swedish version of an existing explainer, add `"translationOf": "<english id>"` — the feed shows one version per language.

### Accuracy

- Every curated explainer cites its sources; `npm run check-links` verifies them (all 22 DOIs are confirmed in the DOI registry; Britannica/Johns Hopkins block automated checks but were confirmed live via the Internet Archive).
- Contested ideas are labelled *Debated* and explain why (e.g. the Dunning–Kruger effect, loss aversion), and popular myths are called out (the "cobra effect", the 10,000-steps origin, the simplified WWII bomber story).
- Health and money items describe research, not advice.
- **AI-generated drafts must be reviewed by a human** — models can cite real papers for claims those papers don't make. The link checker proves a source exists, not that it supports the claim.

---

## Costs

| Item | Cost |
| --- | --- |
| Hosting (Cloudflare Pages / GitHub Pages) | 0 kr |
| Narration (browser speech synthesis) | 0 kr |
| Database / accounts / backend | none exist |
| Adding content by hand or via a free AI chat | 0 kr |
| Optional API generation | only if you choose a paid provider; pay per explainer |

The app works indefinitely with the existing library even if every AI service disappears.

## Limitations

- **Narration** quality depends on the device's voices; Swedish voices are good on iOS/macOS, variable on Android/Windows. Some browsers don't report when speech ends — the player has a safety timeout so it never stalls. iOS requires one tap before speech can start (a "Tap to enable narration" chip appears).
- **Data is per-browser.** No sync — use Export/Import. Clearing site data (or iOS evicting storage for rarely used sites) erases history; installing to the Home Screen makes iOS storage more durable.
- **Content added in Settings stays on that device** until you export it or move it into `content/experiences/`.
- **Library size**: all content is bundled into the app (~3 KB per explainer). That's fine for hundreds of items; if it ever grows into the thousands, split it into lazily loaded JSON.
- **Offline**: available after the first online visit; new content arrives on the next online visit.
- Only 2 explainers are translated to Swedish so far; others show in English (toggle in Settings).

## Project structure

```
content/experiences/   curated library (one JSON per explainer)
content/drafts/        generated/hand-written drafts awaiting review
scripts/               validate, check-links, generate, new, publish-drafts
src/content/           schema (zod), categories, library loader, AI prompt
src/feed/              feed, player engine (usePlayer), card, sheets
src/scenes/            scene templates + SVG illustrations
src/pages/             Explore, Saved, Settings
src/store/             localStorage state + actions
src/lib/               recommender, narration, router, motion level
public/                PWA manifest, service worker, icons
```

Stack: React 18, TypeScript, Vite, Tailwind CSS 4 (base layer) + hand-written CSS, Motion, Zod. Fonts (Fraunces, Inter) are self-hosted via Fontsource.
