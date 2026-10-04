import { expect, test, type Locator, type Page } from "@playwright/test";
import bn from "../app/i18n/bn.json" with { type: "json" };
import voiceData from "../app/lib/voices.json" with { type: "json" };

/**
 * Records every HTMLMediaElement.play()/pause() so tests can assert on what
 * the app *tried* to play without needing real audio output. Each element gets
 * a stable id, which lets the overlap test prove a single element is reused.
 */
async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    type Spy = { plays: { src: string; el: number; rate: number }[]; pauses: number };
    const spy: Spy = { plays: [], pauses: 0 };
    (window as unknown as { __audio: Spy }).__audio = spy;
    const ids = new WeakMap<HTMLMediaElement, number>();
    let next = 0;
    const idOf = (el: HTMLMediaElement) => {
      if (!ids.has(el)) ids.set(el, next++);
      return ids.get(el)!;
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      spy.plays.push({ src: this.src, el: idOf(this), rate: this.playbackRate });
      return play.call(this).catch(() => {});
    };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
      spy.pauses += 1;
      return pause.call(this);
    };
  });
}

const plays = (page: Page) =>
  page.evaluate(() => (window as unknown as { __audio: { plays: { src: string; el: number; rate: number }[] } }).__audio.plays);

/** Tap on touch projects, click elsewhere — exercises the real input path. */
async function press(target: Locator, touch: boolean) {
  if (touch) await target.tap();
  else await target.click();
}

const LATIN = /[A-Za-z]/;
/** The Pages subpath, e.g. "/amar-shorir" — matches next.config.ts. */
const BASE = `/${process.env.PAGES_REPO ?? "amar-shorir"}`;
/** Matches a narration URL under the base path; `path` is a regex fragment. */
const clip = (path: string, voice = voiceData.default) => new RegExp(`${BASE}/audio/${voice}/${path}$`);

test.beforeEach(async ({ page }) => {
  await spyOnAudio(page);
});

test("loads in Bangla with no leftover English UI text", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page).toHaveTitle(bn.meta.title);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bn.organs.heart.name);
  await expect(page.getByText(bn.organs.heart.intro)).toBeVisible();

  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(LATIN);
  // Accessible names, tooltips and alt text are UI text too.
  const attributes = await page.$$eval("[aria-label], [title], img[alt]", (nodes) =>
    nodes.flatMap((node) => ["aria-label", "title", "alt"].map((name) => node.getAttribute(name) ?? "")),
  );
  for (const value of attributes) expect(value).not.toMatch(LATIN);
});

test("shows Bangla numerals, not ASCII digits", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText(bn.organs.heart.daily)).toBeVisible();
  expect(bn.organs.heart.daily).toMatch(/[০-৯]/);
  expect(await page.locator("body").innerText()).not.toMatch(/[0-9]/);
});

test("choosing an organ shows its Bangla info and plays its narration", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  const narration = page.waitForResponse((response) => response.url().endsWith(`${BASE}/audio/${voiceData.default}/brain.mp3`));

  await press(page.locator('[data-organ="brain"]'), touch);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bn.organs.brain.name);
  await expect(page.getByText(bn.organs.brain.funFact)).toBeVisible();
  await expect.poll(() => plays(page)).toEqual([expect.objectContaining({ src: expect.stringMatching(clip("brain\\.mp3")) })]);
  expect((await narration).status()).toBe(200);
});

test("tapping the 3D model plays a narration", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  await expect(page.locator(".viewer-shell")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  // Let the intro animation settle so the organ fills the centre of the canvas.
  await page.waitForTimeout(1500);

  const canvas = page.locator(".three-mount canvas");
  const box = (await canvas.boundingBox())!;
  const point = { x: box.width / 2, y: box.height * 0.45 };
  if (touch) await canvas.tap({ position: point });
  else await canvas.click({ position: point });

  // The centre is the organ itself, or one of its dots — either speaks.
  await expect.poll(() => plays(page)).toEqual([
    expect.objectContaining({ src: expect.stringMatching(clip("heart(\\.mp3|/[a-z-]+\\.mp3)")) }),
  ]);
});

test("each labelled spot has its own narration", async ({ page }) => {
  await page.goto("./");
  // The screen-reader list mirrors the dots and runs the same handler.
  await page.locator(".hotspot-index button").first().evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => plays(page)).toEqual([expect.objectContaining({ src: expect.stringMatching(clip("heart/aorta\\.mp3")) })]);
});

test("a new tap stops the previous narration — sounds never overlap", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  await press(page.locator('[data-organ="lungs"]'), touch);
  await press(page.locator('[data-organ="liver"]'), touch);

  await expect.poll(async () => (await plays(page)).map((entry) => entry.src.split("/").pop())).toEqual(["lungs.mp3", "liver.mp3"]);
  const list = await plays(page);
  expect(new Set(list.map((entry) => entry.el)).size).toBe(1); // one shared element
  const pauses = await page.evaluate(() => (window as unknown as { __audio: { pauses: number } }).__audio.pauses);
  expect(pauses).toBeGreaterThanOrEqual(2); // paused before each new clip
});

test("mute silences narration and survives a reload", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  const mute = page.getByTestId("mute-button");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await expect(mute).toHaveText("🔊");

  await press(mute, touch);
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveText("🔇");
  await press(page.locator('[data-organ="kidneys"]'), touch);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bn.organs.kidneys.name);
  expect(await plays(page)).toEqual([]);

  await page.reload();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await press(page.locator('[data-organ="eyeball"]'), touch);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bn.organs.eyeball.name);
  expect(await plays(page)).toEqual([]);

  await press(mute, touch);
  await press(page.locator('[data-organ="skin"]'), touch);
  await expect.poll(async () => (await plays(page)).length).toBe(1);
});

test("the voice picker switches narrator and remembers it", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  await press(page.getByTestId("voice-button"), touch);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true }).first()).toHaveAttribute("data-voice", voiceData.default);

  // Choosing a voice lets it introduce itself.
  await press(page.locator('[data-voice="dadu"]'), touch);
  await expect(page.locator('[data-voice="dadu"]')).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => plays(page)).toEqual([expect.objectContaining({ src: expect.stringMatching(clip("hello\\.mp3", "dadu")) })]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Narration now uses that voice, also after a reload.
  await press(page.locator('[data-organ="lungs"]'), touch);
  await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip("lungs\\.mp3", "dadu"));
  await page.reload();
  await press(page.locator('[data-organ="liver"]'), touch);
  await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip("liver\\.mp3", "dadu"));
});

test("slow mode plays narration slower", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  await page.goto("./");
  await press(page.getByTestId("voice-button"), touch);
  await press(page.getByTestId("slow-button"), touch);
  await expect(page.getByTestId("slow-button")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await press(page.locator('[data-organ="brain"]'), touch);
  await expect.poll(async () => (await plays(page)).at(-1)).toEqual(
    expect.objectContaining({ src: expect.stringMatching(clip("brain\\.mp3")), rate: expect.any(Number) }),
  );
  expect((await plays(page)).at(-1)!.rate).toBeLessThan(1);
});

test("the find-the-organ game asks, cheers and keeps score", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  const names = Object.fromEntries(Object.entries(bn.organs).map(([id, organ]) => [organ.name, id]));
  await page.goto("./");
  await press(page.getByTestId("quiz-start"), touch);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  for (let round = 0; round < 5; round += 1) {
    const question = (await dialog.locator(".quiz-question span").innerText()).trim();
    const target = Object.entries(names).find(([name]) => question.startsWith(name))?.[1];
    expect(target, question).toBeTruthy();
    await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip(`quiz/${target}\\.mp3`));

    if (round === 0) {
      // A wrong answer is gently corrected and costs the star.
      const wrongOption = dialog.locator(`.quiz-option:not([data-organ="${target}"])`).first();
      await press(wrongOption, touch);
      await expect(wrongOption).toHaveClass(/is-wrong/);
      await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip("quiz/wrong\\.mp3"));
    }
    await press(dialog.locator(`.quiz-option[data-organ="${target}"]`), touch);
    await expect(dialog.locator(`.quiz-option[data-organ="${target}"]`)).toHaveClass(/is-right/);
    await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip("quiz/right-\\d\\.mp3"));
    await press(page.getByTestId("quiz-next"), touch);
  }

  await expect(page.getByTestId("quiz-score")).toHaveText(bn.quiz.score.replace("{total}", "৫").replace("{score}", "৪"));
  await expect.poll(async () => (await plays(page)).at(-1)?.src).toMatch(clip("quiz/done\\.mp3"));
  expect(await dialog.innerText()).not.toMatch(LATIN);
});

test("layout fits the screen with big touch targets", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".viewer-shell")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const viewport = page.viewportSize()!;
  for (const selector of [".mute-button", ".voice-button", ".three-mount canvas", ".tool-button", ".organ-item", ".quiz-card"]) {
    const box = (await page.locator(selector).first().boundingBox())!;
    expect(box.x, selector).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width);
  }

  // Every visible control is at least 48×48 CSS px.
  const small = await page.$$eval("button, a", (nodes) =>
    nodes
      .filter((node) => !node.closest(".hotspot-index") && node.getClientRects().length > 0)
      .map((node) => ({ name: node.getAttribute("aria-label") ?? node.textContent, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 48 || box.height < 48)
      .map(({ name, box }) => `${name} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
  expect(small).toEqual([]);
});

test("every asset loads from the Pages subpath", async ({ page }, testInfo) => {
  const touch = !!testInfo.project.use.hasTouch;
  const failures: string[] = [];
  page.on("response", (response) => response.status() >= 400 && failures.push(`${response.status()} ${response.url()}`));
  page.on("requestfailed", (request) => failures.push(`failed ${request.url()}`));
  page.on("pageerror", (error) => failures.push(`error ${error.message}`));

  await page.goto("./");
  await expect(page.locator(".viewer-shell")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await press(page.locator('[data-organ="pancreas"]'), touch);
  await expect(page.locator(".viewer-shell")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  expect(failures).toEqual([]);
});

test("unknown pages show a friendly Bangla 404", async ({ page }) => {
  const response = await page.goto("./does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading")).toHaveText(bn.notFound.title);
  await expect(page.getByRole("link", { name: bn.notFound.back })).toHaveAttribute("href", `${BASE}/`);
});
