import { expect, test, type Route } from "@playwright/test";

test("the carnival field guide and retry remain usable while route artwork is loading", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bellwind-post.cloud-carnival.v1", "unlocked"));
  await page.goto("games/bellwind-post/");
  await page.getByRole("button", { name: "Cloud Carnival", exact: true }).click();
  const bandstand = "**/art/carnival/bandstand.webp";
  await page.route(bandstand, route => route.abort(), { times: 1 });
  const start = page.getByRole("button", { name: "Start delivery" });
  await start.click();
  await expect(page.getByRole("alert")).toContainText("Cloud Carnival");
  await expect(start).toBeEnabled();

  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(bandstand, async route => { await gate; await route.continue(); });
  const requested = page.waitForRequest(bandstand);
  await start.click();
  await requested;
  try {
    await page.getByRole("button", { name: "Field guide" }).click();
    await expect(page.getByRole("dialog")).toContainText("Kite Midway");
  } finally {
    release();
  }
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#guide-progress")).toContainText(/Cloud Carnival · 0\/12 stamps · 0\/3 seals · Bounce/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Delivery paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume delivery" }).click();
  await expect(page.locator("#route-name")).toHaveText("Cloud Carnival");
  await expect(page.locator("#seals")).toHaveText("0");
  await expect(page.getByRole("alert")).toBeHidden();
  await page.setViewportSize({ width: 667, height: 375 });
  await page.getByRole("button", { name: "Pause delivery" }).click();
  await page.getByRole("button", { name: "Route guide", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Bounce on the bandstand drum");
});

test("a stalled carnival image returns the courier to a retryable desk", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem("bellwind-post.cloud-carnival.v1", "unlocked"));
  await page.goto("games/bellwind-post/");
  await page.getByRole("button", { name: "Cloud Carnival", exact: true }).click();

  let intercept!: (route: Route) => void;
  const stalled = new Promise<Route>(resolve => { intercept = resolve; });
  await page.route("**/art/carnival/bandstand.webp", intercept, { times: 1 });
  const start = page.getByRole("button", { name: "Start delivery" });
  await start.click();
  const request = await stalled;
  try {
    await expect(start).toBeDisabled();
    await page.clock.fastForward(15_001);
    await expect(page.getByRole("alert")).toContainText("Cloud Carnival");
    await expect(start).toBeEnabled();
  } finally {
    await request.continue();
  }
  // The old image can finish or be cancelled after timeout. Neither outcome starts a run.
  const late = await request.request().response();
  if (late) await late.finished();
  await expect(start).toBeFocused();
  await expect(page.locator("#game")).toBeHidden();

  await start.click();
  await expect(page.locator("#route-name")).toHaveText("Cloud Carnival");
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.getByRole("alert")).toBeHidden();
});
