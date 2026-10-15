import { expect, test } from "@playwright/test";

import { failOnConsoleErrors, login, TRADER } from "./support";

test("a manual session on BTCUSDT can place a market order and resume after reload", async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await login(page, TRADER);
  await page.goto("/backtest/sessions/new");
  await page.locator("select").first().selectOption("BTCUSDT");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByRole("region", { name: "Order ticket" })).toBeVisible();
  await page.getByRole("button", { name: /^Buy/ }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Order ticket" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("BTCUSDT simulated")).toHaveCount(0);
  expect(errors).toEqual([]);
});
