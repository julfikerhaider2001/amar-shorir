# আমার শরীর — Bangla 3D body explorer for kids

An interactive 3D anatomy app for children aged about 4–10, entirely in Bangla.
Tap an organ to hear its name and a fun fact read aloud; tap the coloured dots
on the 3D model to hear about each part.

Live: https://thebuggeddev.github.io/anatomy/

## Run it

Requires Node.js ≥ 22.13.

```bash
npm install
npm run dev:next        # http://localhost:3000 (plain Next.js dev server)
npm run preview         # build the GitHub Pages version and serve it at http://localhost:4173/anatomy/
```

`npm run dev` / `npm run build` still use vinext (the original Cloudflare target).

## Edit the Bangla text

**All** user-facing text lives in one file: [`app/i18n/bn.json`](app/i18n/bn.json).

- `organs.<id>` — name, nickname, intro, the four facts, the fun fact, and one
  `{ label, detail }` per coloured dot (`hotspots.<hotspot-id>`).
- Everything else — buttons, tips, titles — is UI copy.
- `{organ}` / `{where}` are placeholders filled in by the app; keep them.
- Write numbers with Bangla numerals (০১২৩৪৫৬৭৮৯). A test fails on any Latin letter
  or ASCII digit in the file. For numbers computed at runtime, use
  `toBanglaDigits()` from `app/i18n`.

Organ ids, 3D model paths and dot positions are in
[`app/lib/anatomy-data.ts`](app/lib/anatomy-data.ts). If you add a dot there, add
its text to `bn.json` too (a test checks they match).

## Regenerate the narration

Narration is pre-rendered to MP3 (most devices have no Bangla voice for
`speechSynthesis`):

```bash
npm run audio                               # re-render clips whose text changed
npm run audio -- --force                    # re-render everything
npm run audio -- --voice bn-BD-PradeepNeural
```

[`scripts/generate-audio.mjs`](scripts/generate-audio.mjs) reads `bn.json` and
writes:

| file | what it says |
| --- | --- |
| `public/audio/<organ-id>.mp3` | `intro` + `funFact` |
| `public/audio/<organ-id>/<hotspot-id>.mp3` | `label` + `detail` |

It uses Microsoft Edge's online neural TTS (voice `bn-BD-NabanitaNeural`; the
same service as the Python `edge-tts` package) through the `msedge-tts` npm
package, so it needs an internet connection but no API key or Python.
`public/audio/manifest.json` records the text of each clip so unchanged clips
are skipped. Commit the MP3s together with the text change.

The click "pop" is synthesised in the browser with the Web Audio API — no
audio file, nothing to license.

## Sound behaviour

- Tapping an organ (in the list, its picture, or on the 3D model) or a dot plays
  a soft pop, then the narration.
- A new tap stops the current narration, so sounds never overlap.
- 🔊/🔇 button (top right) mutes; the choice is saved in `localStorage`.
- Audio only starts from a tap, so mobile autoplay rules never block it.
  Narration files are fetched after the first touch so later taps start instantly.

## Test

```bash
npm run lint
npm run build:pages     # static export to out/ with base path /anatomy
npm test                # Playwright: desktop, phone (375×667), tablet (820×1180)
```

The tests run against the built site under `/anatomy/`, exactly like Pages. First
run: `npx playwright install chromium`.

## Deploy

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
install → lint → static build → Playwright tests → publish to GitHub Pages.

One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

The Pages build is switched on by `GITHUB_PAGES=1`, which turns on
`output: "export"` and `basePath: "/<repo>"` in `next.config.ts`. Asset URLs that
Next doesn't rewrite itself (models, pictures, audio) go through `withBase()` in
[`app/lib/paths.ts`](app/lib/paths.ts).
