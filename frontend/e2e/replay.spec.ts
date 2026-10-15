import { expect, test } from "@playwright/test";

import { failOnConsoleErrors, login, TRADER } from "./support";

test("replay stays on one canvas and does not show the future", async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await login(page, TRADER);
  await page.goto("/trades");
  await page.getByRole("link", { name: /BTCUSDT/ }).first().click();
  await page.getByRole("link", { name: /replay/i }).click();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Step forward one minute" }).click();
  await page.getByRole("button", { name: "Step back one minute" }).click();
  const timeframe = page.getByLabel("Chart timeframe");
  for (const value of ["5m", "15m", "1h", "4h", "1m"]) {
    await timeframe.selectOption(value);
  }
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors, errors.join("\n")).toEqual([]);
});
