import { expect, test } from "@playwright/test";

test("an open dispatch desk can launch Cloud Carnival after another tab saves the unlock", async ({ page, context }) => {
  await page.goto("games/bellwind-post/");
  const carnival = page.getByRole("button", { name: "Cloud Carnival", exact: true });
  await expect(carnival).toBeDisabled();
  const otherTab = await context.newPage();
  await otherTab.goto("games/bellwind-post/");
  await otherTab.evaluate(() => localStorage.setItem("bellwind-post.cloud-carnival.v1", "unlocked"));

  await expect(carnival).toBeEnabled();
  await expect(page.getByRole("button", { name: "Morning Delivery", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.bringToFront();
  await carnival.click();
  await page.getByRole("button", { name: "Start delivery" }).click();
  await expect(page.getByRole("heading", { name: "Cloud Carnival", exact: true })).toBeVisible();
});
