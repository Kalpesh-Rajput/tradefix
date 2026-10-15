import { expect, test } from "@playwright/test";

import { failOnConsoleErrors, login, TRADER } from "./support";

test("a template can be saved", async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await login(page, TRADER);
  await page.goto("/backtest/strategies/new");
  await page.getByRole("button", { name: "Moving-average crossover" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/saved|strategy/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});
