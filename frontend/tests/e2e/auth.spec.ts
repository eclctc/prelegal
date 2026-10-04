import { expect, test } from "@playwright/test";
import { PASSWORD, signUp, uniqueEmail } from "./helpers";

test("shows the sign in screen first and hides the app until signed in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("sign up signs in, survives a reload, and sign out then sign in returns", async ({ page }) => {
  const email = await signUp(page);
  await expect(page.getByRole("heading", { name: "Legal documents" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.reload();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(email)).toBeVisible();
});

test("wrong password and duplicate email show errors", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password");

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("An account with this email already exists");
});

test("signed-out visitors cannot call protected APIs", async ({ request }) => {
  expect((await request.get("/api/documents")).status()).toBe(401);
  expect((await request.post("/api/chat", { data: { messages: [], fields: {} } })).status()).toBe(401);
});

test("backend health endpoint is served alongside the frontend", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("new users start with no documents", async ({ page }) => {
  await signUp(page);
  await page.getByRole("button", { name: "My documents" }).click();
  await expect(page.getByText(/have not created any documents yet/)).toBeVisible();
  expect(uniqueEmail()).toContain("@example.com");
});
