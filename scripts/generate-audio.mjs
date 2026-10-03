/**
 * Pre-renders the Bangla narration with Microsoft Edge's neural TTS (the same
 * service the Python `edge-tts` package uses — no API key needed).
 *
 * Reads app/i18n/bn.json and writes:
 *   public/audio/<organ-id>.mp3               → intro + fun fact
 *   public/audio/<organ-id>/<hotspot-id>.mp3  → label + detail of one dot
 *
 * Only clips whose text changed are re-rendered; public/audio/manifest.json
 * remembers what each file says.
 *
 * Usage:
 *   npm run audio                       # render new/changed clips
 *   npm run audio -- --force            # re-render everything
 *   npm run audio -- --voice bn-BD-PradeepNeural
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const root = new URL("../", import.meta.url);
const outDir = new URL("public/audio/", root);
const manifestUrl = new URL("manifest.json", outDir);

const args = process.argv.slice(2);
const force = args.includes("--force");
const voiceArg = args.indexOf("--voice");
const voice = voiceArg >= 0 ? args[voiceArg + 1] : "bn-BD-NabanitaNeural";
// A touch slower than default: the listeners are 4–10 years old.
const prosody = { rate: "-8%", pitch: "+4%" };

const bn = JSON.parse(await readFile(new URL("app/i18n/bn.json", root), "utf8"));

/** Every clip the app can ask for. Keep in sync with `narrationUrl()` in app/lib/paths.ts. */
function clips() {
  const list = [];
  for (const [organId, organ] of Object.entries(bn.organs)) {
    list.push({ file: `${organId}.mp3`, text: `${organ.intro} ${organ.funFact}` });
    for (const [hotspotId, hotspot] of Object.entries(organ.hotspots)) {
      list.push({ file: `${organId}/${hotspotId}.mp3`, text: `${hotspot.label}! ${hotspot.detail}` });
    }
  }
  return list;
}

const escapeXml = (text) =>
  text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

async function synthesise(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  try {
    const { audioStream } = tts.toStream(escapeXml(text), prosody);
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    const audio = Buffer.concat(chunks);
    if (audio.length < 1000) throw new Error(`suspiciously small clip (${audio.length} bytes)`);
    return audio;
  } finally {
    tts.close();
  }
}

async function withRetry(task, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const manifest = await readFile(manifestUrl, "utf8").then(JSON.parse).catch(() => ({}));
const hash = (text) => createHash("sha1").update(`${voice}|${prosody.rate}|${prosody.pitch}|${text}`).digest("hex").slice(0, 12);

let rendered = 0;
let skipped = 0;
const failures = [];
for (const clip of clips()) {
  const key = hash(clip.text);
  if (!force && manifest[clip.file]?.hash === key) {
    skipped += 1;
    continue;
  }
  try {
    const audio = await withRetry(() => synthesise(clip.text));
    const target = new URL(clip.file, outDir);
    await mkdir(new URL("./", target), { recursive: true });
    await writeFile(target, audio);
    manifest[clip.file] = { hash: key, text: clip.text };
    rendered += 1;
    console.log(`✓ ${clip.file}  (${(audio.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    failures.push(clip.file);
    console.error(`✗ ${clip.file}: ${error.message}`);
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${rendered} rendered, ${skipped} unchanged, ${failures.length} failed — voice ${voice}`);
if (failures.length) process.exit(1);
