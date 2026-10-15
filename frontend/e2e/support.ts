import { expect, test, type Page } from "@playwright/test";

export const TRADER = { email: "e2e-trader@example.com", password: "e2e-pass-1" };
export const ADMIN = { email: "e2e-admin@example.com", password: "e2e-pass-1" };

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export function failOnConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}
