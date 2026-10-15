import { expect, test } from "@playwright/test";

import { ADMIN, failOnConsoleErrors, login, TRADER } from "./support";

test("a normal user cannot open market-data admin", async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await login(page, TRADER);
  await page.goto("/admin/data-status");
  await expect(page.getByText(/admin access is required/i)).toBeVisible();
  expect(errors.filter((line) => !line.includes("403"))).toEqual([]);
});

test("an admin sees coverage", async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await login(page, ADMIN);
  await page.goto("/admin/data-status");
  await expect(page.getByRole("heading", { name: "Market data" })).toBeVisible();
  await expect(page.getByText("BTCUSDT")).toBeVisible();
  expect(errors).toEqual([]);
});
