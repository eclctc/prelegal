import { expect, test } from "@playwright/test";

test("shows the login screen first and signs in without credentials", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Prelegal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legal documents" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Legal documents" })).toBeVisible();
});

test("stays signed in after a reload within the session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Legal documents" })).toBeVisible();
});

test("backend health endpoint is served alongside the frontend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});
