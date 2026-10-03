import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
});

test("no console errors or hydration warnings on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mutual NDA" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("default effective date is the browser's local today", async ({ page }) => {
  await page.goto("/");
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(page.getByLabel("Effective date", { exact: true })).toHaveValue(today);
});

test("effective date uses the viewer's timezone near midnight", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "Pacific/Auckland" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-03-05T11:30:00Z") }); // 00:30 Mar 6 in Auckland
  await page.goto("/");
  await expect(page.getByLabel("Effective date", { exact: true })).toHaveValue("2026-03-06");
  await expect(page.getByRole("article")).toContainText("March 6, 2026");
  await ctx.close();
});

test("fills the form end to end and previews the agreement", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Governing law").fill("Delaware");
  await page.getByLabel("Jurisdiction").fill("New Castle, DE");
  await page.getByLabel("Modifications").fill("Section 8 is deleted.");
  const parties = page.getByRole("group", { name: /Party/ });
  await parties.nth(0).getByLabel("Company").fill("Acme Inc");
  await parties.nth(1).getByLabel("Company").fill("Globex LLC");
  const doc = page.getByRole("article");
  await expect(doc).toContainText("laws of the State of Delaware");
  await expect(doc).toContainText("courts located in New Castle, DE");
  await expect(doc).toContainText("Section 8 is deleted.");
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Acme Inc");
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Globex LLC");
});

test("term options change the agreement text", async ({ page }) => {
  await page.goto("/");
  const doc = page.getByRole("article");
  await page.getByLabel("MNDA term in years").fill("3");
  await expect(doc).toContainText("expires 3 years after the Effective Date");
  await page.getByRole("radio", { name: "Continues until terminated" }).check();
  await page.getByRole("radio", { name: "In perpetuity" }).check();
  await expect(doc).toContainText("continues until terminated in accordance with the terms of this MNDA");
  await expect(doc).toContainText("will survive in perpetuity");
  await expect(doc).not.toContainText("end of the until");
});

test("arrow keys move between radios in a group", async ({ page }) => {
  await page.goto("/");
  const first = page.getByRole("radio", { name: "Expires after a fixed number of years" });
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Continues until terminated" })).toBeChecked();
});

test("malicious input renders as plain text", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Purpose").fill("# Pwned <script>window.__x=1</script> <img src=x onerror=window.__x=1>");
  const doc = page.getByRole("article");
  await expect(doc.getByRole("heading", { name: /Pwned/ })).toHaveCount(0);
  await expect(doc.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  await expect(doc).toContainText("# Pwned");
});

test("downloads a Markdown file with the filled-in agreement", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Governing law").fill("New York");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Mutual-NDA.md");
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("# Mutual Non-Disclosure Agreement");
  expect(text).toContain("Governing Law: New York");
  expect(text).toContain("laws of the State of **New York**");
  expect(text).toContain("# Standard Terms");
  expect(text).toContain("CC BY 4.0");
  expect(text).not.toContain("coverpage_link");
});

test("print layout hides the form and shows the whole agreement", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 }); // landscape-sized
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("aside")).toBeHidden();
  await expect(page.getByRole("button", { name: /Download/ })).toBeHidden();
  const main = page.locator("main");
  const [scrollH, clientH] = await main.evaluate((el) => [el.scrollHeight, el.clientHeight]);
  expect(scrollH).toBeLessThanOrEqual(clientH + 1); // not clipped to one screen
  const articleBox = (await page.getByRole("article").boundingBox())!;
  expect(articleBox.x).toBeLessThan(40); // no reserved sidebar column
});

test("PDF export produces a multi-page file", async ({ page }) => {
  await page.goto("/");
  const pdf = await page.pdf({ format: "Letter" });
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
  expect(pages.length).toBeGreaterThan(2);
});

test("layout works at phone width without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Governing law")).toBeVisible();
  await expect(page.getByRole("article")).toBeVisible();
});

test("numeric inputs keep what the user types", async ({ page }) => {
  await page.goto("/");
  const box = page.getByLabel("Confidentiality term in years");
  await box.fill("");
  await box.pressSequentially("5");
  await expect(box).toHaveValue("5");
  await expect(page.getByRole("article")).toContainText("5 year(s) from Effective Date, but");
});
