import { expect, test, type Locator, type Page } from "@playwright/test";
import bn from "../app/i18n/bn.json" with { type: "json" };

/**
 * Records every HTMLMediaElement.play()/pause() so tests can assert on what
 * the app *tried* to play without needing real audio output. Each element gets
 * a stable id, which lets the overlap test prove a single element is reused.
 */
async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    type Spy = { plays: { src: string; el: number }[]; pauses: number };
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
      spy.plays.push({ src: this.src, el: idOf(this) });
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
  page.evaluate(() => (window as unknown as { __audio: { plays: { src: string; el: number }[] } }).__audio.plays);

/** Tap on touch projects, click elsewhere — exercises the real input path. */
async function press(target: Locator, touch: boolean) {
  if (touch) await target.tap();
  else await target.click();
}

const LATIN = /[A-Za-z]/;

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
  const narration = page.waitForResponse((response) => response.url().endsWith("/anatomy/audio/brain.mp3"));

  await press(page.locator('[data-organ="brain"]'), touch);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(bn.organs.brain.name);
  await expect(page.getByText(bn.organs.brain.funFact)).toBeVisible();
  await expect.poll(() => plays(page)).toEqual([expect.objectContaining({ src: expect.stringMatching(/\/anatomy\/audio\/brain\.mp3$/) })]);
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
    expect.objectContaining({ src: expect.stringMatching(/\/anatomy\/audio\/heart(\.mp3|\/[a-z-]+\.mp3)$/) }),
  ]);
});

test("each labelled spot has its own narration", async ({ page }) => {
  await page.goto("./");
  // The screen-reader list mirrors the dots and runs the same handler.
  await page.locator(".hotspot-index button").first().evaluate((button: HTMLButtonElement) => button.click());
  await expect.poll(() => plays(page)).toEqual([expect.objectContaining({ src: expect.stringMatching(/\/anatomy\/audio\/heart\/aorta\.mp3$/) })]);
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

test("layout fits the screen with big touch targets", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".viewer-shell")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const viewport = page.viewportSize()!;
  for (const selector of [".mute-button", ".three-mount canvas", ".tool-button", ".organ-item"]) {
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
  await expect(page.getByRole("link", { name: bn.notFound.back })).toHaveAttribute("href", "/anatomy/");
});
