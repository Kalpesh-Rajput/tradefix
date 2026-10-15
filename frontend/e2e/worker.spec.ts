import { expect, test } from "@playwright/test";

import { ADMIN, login, TRADER } from "./support";

async function stubWorker(page: import("@playwright/test").Page, admin: boolean) {
  await page.route("**/api/market-data/worker", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stale: true,
        slow_after_s: 0,
        message: "The background worker appears offline.",
        ...(admin ? { command: "python scripts/dev.py", heartbeat_age_s: 999 } : {}),
      }),
    }),
  );
}

test("an admin sees why the worker looks offline", async ({ page }) => {
  await stubWorker(page, true);
  await login(page, ADMIN);
  await page.goto("/trades");
  await page.getByRole("link", { name: /BTCUSDT/ }).first().click();
  await page.getByRole("link", { name: /replay/i }).click();
  await expect(page.getByText("The background worker appears offline.")).toBeVisible();
  await expect(page.getByText("python scripts/dev.py")).toBeVisible();
});

test("a normal user does not see the start command", async ({ page }) => {
  await stubWorker(page, false);
  await login(page, TRADER);
  await page.goto("/trades");
  await page.getByRole("link", { name: /BTCUSDT/ }).first().click();
  await page.getByRole("link", { name: /replay/i }).click();
  await expect(page.getByText("The background worker appears offline.")).toBeVisible();
  await expect(page.getByText("python scripts/dev.py")).toHaveCount(0);
});
