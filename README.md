# আমার শরীর — Bangla 3D body explorer for kids

An interactive 3D anatomy app for children aged about 4–10, entirely in Bangla.
Tap an organ to hear its name and a fun fact read aloud; tap the coloured dots
on the 3D model to hear about each part.

- **6 narrators** (🗣️ button, top right): আপু, ভাইয়া, দিদি, দাদা, পুতুল, দাদু —
  each introduces itself when tapped. A 🐢 slow mode reads more slowly.
- **Game** (🎮 খেলি!): "where is the heart?" — the question is spoken, the
  answers are pictures, so children who can't read yet can play. Five rounds,
  a star for every first-try answer.
- **Works offline**: as an Android/iOS app, or as a website added to the home
  screen.

Live: https://julfikerhaider2001.github.io/amar-shorir/

## Run it

Requires Node.js ≥ 22.13.

```bash
npm install
npm run dev:next        # http://localhost:3000 (plain Next.js dev server)
npm run preview         # build the GitHub Pages version and serve it at http://localhost:4173/amar-shorir/
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
npm run audio                    # re-render clips whose text changed
npm run audio -- --force         # re-render everything
npm run audio -- --only dadu     # one voice
```

[`scripts/generate-audio.mjs`](scripts/generate-audio.mjs) reads `bn.json` and
writes, for every voice in [`app/lib/voices.json`](app/lib/voices.json):

| file (under `public/audio/<voice>/`) | what it says |
| --- | --- |
| `<organ-id>.mp3` | `intro` + `funFact` |
| `<organ-id>/<hotspot-id>.mp3` | `label` + `detail` |
| `hello.mp3` | `voices.<voice>.hello` |
| `quiz/<organ-id>.mp3` | `quiz.ask` with the organ's name |
| `quiz/right-N.mp3`, `quiz/wrong.mp3`, `quiz/done.mp3` | quiz feedback |

It uses Microsoft Edge's online neural TTS (the same service as the Python
`edge-tts` package) through the `msedge-tts` npm package, so it needs an
internet connection but no API key or Python. There are four Bangla neural
voices (two Bangladeshi, two Indian); পুতুল and দাদু are the Bangladeshi ones
with the pitch and speed changed. To add a narrator: add it to `voices.json`,
add its name, description and `hello` line under `voices` in `bn.json`, run
`npm run audio`.

**Clear "sh" (শ/ষ)**: the TTS does say "sh", but it is a soft hiss around
2.5–5 kHz that phone speakers and low-bitrate MP3 blur. So each clip is fetched
at the best bitrate, decoded, given a +6 dB boost around 3.8 kHz, loudness-matched
across voices and re-encoded at 64 kbps. Speech is also ~12% slower than the
default.

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

## Phone apps (Android & iOS)

The same site is wrapped as a native app with [Capacitor](https://capacitorjs.com)
— every model, picture and narration ships inside, so it works with no internet.
`APP_BUILD=1` builds the static export at the root (no `/amar-shorir` prefix).

**Android APK** (needs JDK 21 + Android SDK; set `JAVA_HOME` / `ANDROID_HOME`):

```bash
npm run android:apk      # → release/amar-shorir.apk
```

Copy the APK to the phone, open it, and allow "install unknown apps" when asked.
It is a debug-signed build: fine for sharing with family, not for the Play
Store (that needs a release keystore — `npx cap open android`, then
*Build → Generate Signed Bundle*). The [Build Android APK](.github/workflows/android.yml)
workflow also builds it on every push; download it from the run's *Artifacts*.

**iOS** needs a Mac with Xcode: `npm run build:app && npx cap open ios`, pick
your Apple ID under *Signing & Capabilities*, and run on a connected iPhone.
Without a Mac, open the website in Safari → Share → *Add to Home Screen*; it
then opens full screen and keeps working offline.

App icons and splash screens are generated from `assets/` with
`npx @capacitor/assets generate --iconBackgroundColor '#fbf3e9' --splashBackgroundColor '#fff4d6'`.

## Test

```bash
npm run lint
npm run build:pages     # static export to out/ with base path /amar-shorir
npm test                # Playwright: desktop, phone (375×667), tablet (820×1180)
```

The tests run against the built site under `/amar-shorir/`, exactly like Pages. First
run: `npx playwright install chromium`.

## Deploy

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
install → lint → static build → Playwright tests → publish to GitHub Pages.

One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

The Pages build is switched on by `GITHUB_PAGES=1`, which turns on
`output: "export"` and `basePath: "/<repo>"` in `next.config.ts`. Asset URLs that
Next doesn't rewrite itself (models, pictures, audio) go through `withBase()` in
[`app/lib/paths.ts`](app/lib/paths.ts).
