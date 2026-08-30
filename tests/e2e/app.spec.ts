import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, q = 10, review = 0) {
  await page.goto(`/?q=${q}&review=${review}&timing=test`);
  await page.getByRole("button", { name: /Start Catechism Time/ }).click();
}
async function listenToSay(page: Page) {
  if (await page.locator("main").getAttribute("data-phase") === "hidden") await page.keyboard.press("Space");
  await page.waitForTimeout(190);
  if (await page.locator("main").getAttribute("data-phase") === "revealing") {
    await page.keyboard.press("Space");
    await page.waitForTimeout(190);
  }
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
}
async function finishRecitation(page: Page) {
  const phase = await page.locator("main").getAttribute("data-phase");
  if (phase === "hidden") await page.keyboard.press("Space");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "complete", { timeout: 4000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
}
async function reach(page: Page, kind: string) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator("main").getAttribute("data-stage") === kind) return;
    const current = await page.locator("main").getAttribute("data-stage");
    if (current === "meet") { await page.keyboard.press("Space"); await page.waitForTimeout(190); await page.keyboard.press("Space"); await page.waitForTimeout(350); }
    else if (["review", "say", "challenge"].includes(current ?? "")) await finishRecitation(page);
    else { await page.keyboard.press("Space"); await page.waitForTimeout(350); }
  }
  throw new Error(`Did not reach ${kind}`);
}

test("setup defaults and lets the query override reading pace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("recitation-speed")).toHaveValue("3");
  await page.goto("/?speed=1");
  await expect(page.getByTestId("recitation-speed")).toHaveValue("1");
  await page.goto("/?speed=99");
  await expect(page.getByTestId("recitation-speed")).toHaveValue("5");
});

test("a confirmed setup resumes at the first presentation screen after restart", async ({ page }) => {
  await page.goto("/?timing=test");
  await page.getByTestId("question-select").selectOption("12");
  await page.getByTestId("review-count").selectOption("3");
  await page.getByTestId("recitation-speed").selectOption("4");
  await page.getByRole("button", { name: /Start Catechism Time/ }).click();

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "review");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Which question are we learning?" })).toBeVisible();
  await expect(page.getByTestId("question-select")).toHaveValue("12");
  await expect(page.getByTestId("review-count")).toHaveValue("3");
  await expect(page.getByTestId("recitation-speed")).toHaveValue("4");
});

test("malformed saved settings fall back to setup safely", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("catechism-presentation-settings", "{broken"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Which question are we learning?" })).toBeVisible();
  await expect(page.getByTestId("question-select")).toHaveValue("1");
});

test("Listen reveals once and advances directly to guided Say", async ({ page }) => {
  await page.goto("/?q=10&review=0&speed=3");
  await page.getByRole("button", { name: /Start/ }).click();
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "revealing");
  const reserved = await page.locator(".answer").boundingBox();
  await expect(page.locator(".reveal-word.revealed")).not.toHaveCount(0);
  await expect(page.locator(".reveal-word:not(.revealed)")).not.toHaveCount(0);
  await expect(page.locator(".countdown, .word.active, .word.trailing, .question-stream, .word-stream")).toHaveCount(0);
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await expect(page.locator(".reveal-word:not(.revealed)")).toHaveCount(0);
  const completed = await page.locator(".answer").boundingBox();
  expect(completed).toEqual(reserved);
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await expect(page.locator(".answer")).toBeEmpty();
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
  await page.keyboard.press("Space");
  await expect(page.locator(".countdown")).toBeVisible();
  await expect(page.locator(".word.active")).toBeVisible({ timeout: 5000 });
});

test("presentation clicker Page and vertical Arrow keys preserve navigation semantics", async ({ page }) => {
  await start(page, 10);
  await page.evaluate(() => {
    window.addEventListener("keydown", (event) => {
      if (["PageDown", "PageUp", "ArrowDown", "ArrowUp"].includes(event.key))
        setTimeout(() => sessionStorage.setItem(`prevented-${event.key}`, String(event.defaultPrevented)));
    });
  });
  const initialScroll = await page.evaluate(() => scrollY);
  await page.keyboard.press("PageDown");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "revealing");
  await page.waitForTimeout(190);
  await page.keyboard.press("PageDown");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.waitForTimeout(190);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
  await page.keyboard.press("PageUp");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.waitForTimeout(190);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(190);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(190);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "countdown");
  await page.waitForTimeout(190);
  await page.keyboard.press("PageDown");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(190);
  await page.keyboard.press("PageDown");
  await expect(page.locator("main")).not.toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(190);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
  for (const key of ["PageDown", "PageUp", "ArrowDown", "ArrowUp"])
    expect(await page.evaluate((name) => sessionStorage.getItem(`prevented-${name}`), key)).toBe("true");
});

test("reveal cleanup handles Left, Restart, visibility, and Escape", async ({ page }) => {
  await page.goto("/?q=1&review=0&speed=3");
  await page.getByRole("button", { name: /Start/ }).click();
  await page.waitForTimeout(350);
  await page.keyboard.press("Space"); await page.waitForTimeout(190); await page.keyboard.press("ArrowLeft");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await expect(page.locator(".reveal-stream")).toHaveCount(0);
  await page.waitForTimeout(190); await page.keyboard.press("Space"); await page.waitForTimeout(190);
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.keyboard.press("Space");
  await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: true }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Which question are we learning?" })).toBeVisible();
});

test("guided speech highlights question, boundary, then answer and pauses in either region", async ({ page }) => {
  await page.goto("/?q=10&review=0&speed=5");
  await page.getByRole("button", { name: /Start/ }).click();
  await listenToSay(page);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-active-region", "question", { timeout: 5000 });
  await expect(page.locator("h1 .word.active")).toBeVisible();
  await expect(page.locator("h1 .word.trailing")).toBeVisible({ timeout: 1200 });
  await expect(page.locator(".answer .word.active")).toHaveCount(0);
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await expect(page.locator(".word.trailing")).toHaveCount(0);
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-active-region", "boundary", { timeout: 4000 });
  await expect(page.locator(".word.active")).toHaveCount(0);
  await expect(page.locator(".word.trailing")).toHaveCount(0);
  await expect(page.locator("main")).toHaveAttribute("data-active-region", "answer", { timeout: 1500 });
  await expect(page.locator(".answer .word.active")).toBeVisible();
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "reciting");
  await expect(page.locator(".step")).toHaveText("2 / 6");
});

test("Settings from question, boundary, or answer cannot leak a stale highlight into a new session", async ({ page }) => {
  for (const region of ["question", "boundary", "answer"] as const) {
    await page.goto("/?q=10&review=0&speed=5");
    await page.getByRole("button", { name: /Start/ }).click();
    await listenToSay(page);
    await page.keyboard.press("Space");
    await page.waitForFunction((wanted) => document.querySelector("main")?.getAttribute("data-active-region") === wanted, region, { timeout: 7000, polling: 20 });
    if (region === "boundary") {
      await page.waitForTimeout(190);
      await page.keyboard.press("Space");
      await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
      await page.waitForTimeout(190);
      await page.keyboard.press("Space");
      await expect(page.locator("main")).toHaveAttribute("data-active-region", "boundary");
      await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: true }));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
    }
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: /Start/ }).click();
    await page.waitForTimeout(350);
    await page.keyboard.press("Space");
    await page.waitForTimeout(190);
    await page.keyboard.press("Space");
    await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("main")).toHaveAttribute("data-active-region", "none");
    await expect(page.locator(".word.active")).toHaveCount(0);
    await expect(page.locator(".word.trailing")).toHaveCount(0);
    await page.getByRole("button", { name: "Settings" }).click();
  }
});

test("Space pauses and resumes while Left cancels to ready", async ({ page }) => {
  await page.goto("/?q=4&review=0&speed=5");
  await page.getByRole("button", { name: /Start/ }).click();
  await listenToSay(page);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "countdown");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(200);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await page.keyboard.press("Space");
  await expect(page.locator("main")).not.toHaveAttribute("data-phase", "paused");
  await page.waitForTimeout(190);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.waitForTimeout(500);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
});

test("every countdown beat pulses and resumes without a blank boundary", async ({ page }) => {
  for (const label of ["3", "2", "1", "Together"]) {
    await page.goto("/?q=4&review=0&speed=5");
    await page.getByRole("button", { name: /Start/ }).click();
    await listenToSay(page);
    await page.keyboard.press("Space");
    const beat = page.locator(`[data-countdown-beat="${label}"]`);
    await expect(beat).toBeVisible({ timeout: 4000 });
    await expect(beat).toHaveCSS("animation-name", "countdown-pulse");
    await page.waitForTimeout(190);
    await page.keyboard.press("Space");
    await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
    await page.waitForTimeout(190);
    await page.keyboard.press("Space");
    await expect(page.locator(".countdown span")).not.toBeEmpty();
    if (label === "Together") {
      await expect(page.locator("main")).toHaveAttribute("data-phase", "reciting", { timeout: 1500 });
      await expect(page.locator(".word.active")).toBeVisible();
    }
    await page.getByRole("button", { name: "Settings" }).click();
  }
});

test("rapid clicker input cannot skip phases and restart works during transition lock", async ({ page }) => {
  await start(page, 4);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.waitForTimeout(190);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "say");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Which question are we learning?" })).toBeVisible();
});

test("visibility pause, Escape, restart, and Again cancel stale timers", async ({ page }) => {
  await start(page, 7);
  await listenToSay(page);
  await page.keyboard.press("Space");
  await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: true }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("main")).toHaveAttribute("data-phase", "paused");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.waitForTimeout(500);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Which question are we learning?" })).toBeVisible();
});

test("Missing Words becomes exact text for countdown and recitation", async ({ page }) => {
  await start(page, 10);
  await reach(page, "say");
  await expect(page.locator(".answer")).toContainText("_____");
  await page.keyboard.press("Space");
  await expect(page.locator(".answer .sr-only")).toHaveText("Yes, God knows all things. Nothing can be hidden from God.");
});

test("Scripture is wide, never highlights, and flows to From memory then close", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 21);
  await reach(page, "scripture");
  await expect(page.locator(".word")).toHaveCount(0);
  expect(await page.locator("blockquote").evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(900);
  await reach(page, "challenge");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
  const memoryHidden = await page.locator(".stage").boundingBox();
  await page.keyboard.press("Space");
  await expect(page.locator(".reveal-stream")).toBeVisible();
  await page.waitForTimeout(190);
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await expect(page.locator(".reveal-word:not(.revealed)")).toHaveCount(0);
  expect(await page.locator(".stage").boundingBox()).toEqual(memoryHidden);
  await finishRecitation(page);
  await expect(page.locator("main")).toHaveAttribute("data-stage", "close");
  await page.getByRole("button", { name: "Again" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-stage", "meet");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "hidden");
});

test("stage transitions have direction, keep progress stage-based, and reduced motion stays timed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page, 2, 0);
  await expect(page.locator(".step")).toHaveText("1 / 6");
  await page.keyboard.press("Space");
  await expect(page.locator("main")).toHaveAttribute("data-phase", "ready");
  await expect(page.locator(".reveal-word:not(.revealed)")).toHaveCount(0);
  await listenToSay(page);
  await expect(page.locator(".stage-forward")).toBeVisible();
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(350);
  await expect(page.locator(".stage-back")).toBeVisible();
  await expect(page.locator(".stage")).toHaveCSS("animation-duration", "0s");
  await expect(page.locator(".step")).toHaveText("1 / 6");
});

test("longest answer fits projector and phone without highlight reflow", async ({ page }) => {
  for (const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await start(page, 1);
    await listenToSay(page);
    const before = await page.locator(".answer").boundingBox();
    await page.keyboard.press("Space");
    await expect(page.locator(".word.active")).toBeVisible({ timeout: 1500 });
    const during = await page.locator(".answer").boundingBox();
    expect(Math.abs((before?.height ?? 0) - (during?.height ?? 0))).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press("Escape");
  }
});
