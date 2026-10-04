/**
 * Pre-renders the Bangla narration with Microsoft Edge's neural TTS (the same
 * service the Python `edge-tts` package uses — no API key needed), once per
 * voice in app/lib/voices.json.
 *
 * Reads app/i18n/bn.json and writes, for every voice:
 *   public/audio/<voice>/<organ-id>.mp3               → intro + fun fact
 *   public/audio/<voice>/<organ-id>/<hotspot-id>.mp3  → label + detail of one dot
 *   public/audio/<voice>/hello.mp3                    → the voice introducing itself
 *   public/audio/<voice>/quiz/<organ-id>.mp3          → "where is the …?" question
 *   public/audio/<voice>/quiz/{right-N,wrong,done}.mp3 → quiz feedback
 *
 * Clarity: Bangla শ/ষ ("sh") is a soft hiss around 2.5–5 kHz that small phone
 * speakers and low-bitrate MP3 smear into mush. Each clip is fetched at the
 * service's best bitrate, decoded, given a presence boost centred on that band
 * (plus a rumble filter), loudness-matched across voices, and re-encoded.
 *
 * Only clips whose text, voice or processing changed are re-rendered;
 * public/audio/manifest.json remembers what each file says.
 *
 * Usage:
 *   npm run audio                  # render new/changed clips
 *   npm run audio -- --force       # re-render everything
 *   npm run audio -- --only apu    # one voice
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { MPEGDecoder } from "mpg123-decoder";
import { Mp3Encoder } from "@breezystack/lamejs";

const root = new URL("../", import.meta.url);
const outDir = new URL("public/audio/", root);
const manifestUrl = new URL("manifest.json", outDir);

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.indexOf("--only");
const only = onlyArg >= 0 ? args[onlyArg + 1] : null;

/** Bump when the processing chain changes so every clip re-renders. */
const PROCESSING = "eq3800+6/hp80/rms-20/64k";
const BITRATE = 64;
const CONCURRENCY = 4;

const bn = JSON.parse(await readFile(new URL("app/i18n/bn.json", root), "utf8"));
const { voices } = JSON.parse(await readFile(new URL("app/lib/voices.json", root), "utf8"));

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);

/** Every clip the app can ask for. Keep in sync with app/lib/clips.ts. */
function clips(voiceId) {
  const list = [{ file: "hello.mp3", text: bn.voices[voiceId].hello }];
  for (const [organId, organ] of Object.entries(bn.organs)) {
    list.push({ file: `${organId}.mp3`, text: `${organ.intro} ${organ.funFact}` });
    list.push({ file: `quiz/${organId}.mp3`, text: fill(bn.quiz.ask, { organ: organ.name }) });
    for (const [hotspotId, hotspot] of Object.entries(organ.hotspots)) {
      list.push({ file: `${organId}/${hotspotId}.mp3`, text: `${hotspot.label}! ${hotspot.detail}` });
    }
  }
  bn.quiz.right.forEach((text, index) => list.push({ file: `quiz/right-${index + 1}.mp3`, text }));
  list.push({ file: "quiz/wrong.mp3", text: bn.quiz.wrong });
  list.push({ file: "quiz/done.mp3", text: bn.quiz.done });
  return list;
}

const escapeXml = (text) =>
  text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

async function synthesise(text, voice) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  try {
    const { audioStream } = tts.toStream(escapeXml(text), { rate: voice.rate, pitch: voice.pitch });
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    const audio = Buffer.concat(chunks);
    if (audio.length < 1000) throw new Error(`suspiciously small clip (${audio.length} bytes)`);
    return audio;
  } finally {
    tts.close();
  }
}

// ---------------------------------------------------------------- processing

/** RBJ audio-EQ-cookbook biquads, normalised so a0 = 1. */
function biquad(b, a) {
  return { b: b.map((v) => v / a[0]), a: [1, a[1] / a[0], a[2] / a[0]] };
}
function peaking(f0, gainDb, q, sampleRate) {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  return biquad([1 + alpha * A, -2 * cos, 1 - alpha * A], [1 + alpha / A, -2 * cos, 1 - alpha / A]);
}
function highPass(f0, q, sampleRate) {
  const w = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  return biquad([(1 + cos) / 2, -(1 + cos), (1 + cos) / 2], [1 + alpha, -2 * cos, 1 - alpha]);
}
function filter(input, { b, a }) {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const y = b[0] * input[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = input[i]; y2 = y1; y1 = y;
    output[i] = y;
  }
  return output;
}

/** A fresh decoder per clip: mpg123-decoder's reset() leaves it unable to
 *  decode the next stream. */
async function decode(mp3) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const { channelData, sampleRate, errors } = decoder.decode(new Uint8Array(mp3));
    if (errors.length) throw new Error(`decode: ${errors[0].message}`);
    return { samples: channelData[0], sampleRate };
  } finally {
    decoder.free();
  }
}

async function enhance(mp3) {
  let { samples, sampleRate } = await decode(mp3);
  samples = filter(samples, highPass(80, 0.707, sampleRate));
  samples = filter(samples, peaking(3800, 6, 0.9, sampleRate));

  // Match loudness across voices (RMS of the speech, ignoring pauses), but
  // never let a peak clip.
  let peak = 0, sum = 0, count = 0;
  for (const value of samples) {
    const magnitude = Math.abs(value);
    peak = Math.max(peak, magnitude);
    if (magnitude > 0.01) { sum += value * value; count += 1; }
  }
  const rms = Math.sqrt(sum / Math.max(count, 1));
  const gain = Math.min(10 ** (-20 / 20) / rms, 0.89 / peak);

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain * 32767)));
  }
  const encoder = new Mp3Encoder(1, sampleRate, BITRATE);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) parts.push(encoder.encodeBuffer(pcm.subarray(i, i + 1152)));
  parts.push(encoder.flush());
  return Buffer.concat(parts.map((part) => Buffer.from(part.buffer, part.byteOffset, part.byteLength)));
}

// ---------------------------------------------------------------- run

async function withRetry(task, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

const manifest = await readFile(manifestUrl, "utf8").then(JSON.parse).catch(() => ({}));
const hash = (voice, text) =>
  createHash("sha1").update(`${voice.voice}|${voice.rate}|${voice.pitch}|${PROCESSING}|${text}`).digest("hex").slice(0, 12);

const jobs = [];
for (const voice of voices) {
  if (only && voice.id !== only) continue;
  for (const clip of clips(voice.id)) {
    const file = `${voice.id}/${clip.file}`;
    const key = hash(voice, clip.text);
    if (force || manifest[file]?.hash !== key) jobs.push({ file, key, text: clip.text, voice });
  }
}
let rendered = 0;
const failures = [];
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    try {
      const audio = await enhance(await withRetry(() => synthesise(job.text, job.voice)));
      const target = new URL(job.file, outDir);
      await mkdir(new URL("./", target), { recursive: true });
      await writeFile(target, audio);
      manifest[job.file] = { hash: job.key, text: job.text };
      rendered += 1;
      console.log(`✓ ${job.file}  (${(audio.length / 1024).toFixed(0)} KB)`);
    } catch (error) {
      failures.push(job.file);
      console.error(`✗ ${job.file}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Drop clips that no voice/text produces any more (e.g. a removed hotspot).
const wanted = new Set(voices.flatMap((voice) => clips(voice.id).map((clip) => `${voice.id}/${clip.file}`)));
for (const file of Object.keys(manifest)) {
  if (wanted.has(file)) continue;
  delete manifest[file];
  await rm(new URL(file, outDir), { force: true });
}

await mkdir(outDir, { recursive: true });
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(manifestUrl, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\n${rendered} rendered, ${failures.length} failed — ${wanted.size} clips across ${voices.length} voices`);
if (failures.length) process.exit(1);
