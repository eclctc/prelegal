import type { Page } from "@playwright/test";

/** Opens the app and passes the placeholder login screen. */
export async function openApp(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
}
