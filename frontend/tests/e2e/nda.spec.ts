import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openApp, say } from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
});

test("no console errors or hydration warnings on load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openApp(page);
  await expect(page.getByRole("heading", { name: "Mutual NDA" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("default effective date is the browser's local today", async ({ page }) => {
  await openApp(page);
  const longDate = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  );
  await expect(page.getByRole("article")).toContainText(longDate);
});

test("effective date uses the viewer's timezone near midnight", async ({ browser }) => {
  const ctx = await browser.newContext({ timezoneId: "Pacific/Auckland" });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date("2026-03-05T11:30:00Z") }); // 00:30 Mar 6 in Auckland
  await openApp(page);
  await expect(page.getByRole("article")).toContainText("March 6, 2026");
  await ctx.close();
});

test("AI opens the chat and a conversation fills in the agreement", async ({ page }) => {
  const requests = await openApp(page, [
    { reply: "Noted. Who are the parties?", fields: { governingLaw: "Delaware", jurisdiction: "New Castle, DE" } },
    { reply: "Great, all set.", fields: { party1: { company: "Acme Inc" }, party2: { company: "Globex LLC" }, modifications: "Section 8 is deleted." } },
  ]);
  expect(requests[0].messages).toHaveLength(1); // hidden opening message only
  await say(page, "Delaware law, courts in New Castle");
  await expect(page.getByText("Noted. Who are the parties?")).toBeVisible();
  await say(page, "Acme and Globex, delete section 8");
  await expect(page.getByText("Great, all set.")).toBeVisible();
  expect(requests[2].messages.at(-1)?.content).toBe("Acme and Globex, delete section 8");
  expect(requests[2].messages.length).toBeGreaterThan(requests[1].messages.length);
  const doc = page.getByRole("article");
  await expect(doc).toContainText("laws of the State of Delaware");
  await expect(doc).toContainText("courts located in New Castle, DE");
  await expect(doc).toContainText("Section 8 is deleted.");
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Acme Inc");
  await expect(doc.getByRole("row", { name: /Company/ })).toContainText("Globex LLC");
});

test("AI-chosen term options change the agreement text", async ({ page }) => {
  await openApp(page, [
    { reply: "Done.", fields: { termYears: 3 } },
    { reply: "Updated.", fields: { termKind: "continues", confidentialityKind: "perpetuity" } },
  ]);
  const doc = page.getByRole("article");
  await say(page, "three years");
  await expect(doc).toContainText("expires 3 years after the Effective Date");
  await say(page, "actually until terminated, confidentiality forever");
  await expect(doc).toContainText("continues until terminated in accordance with the terms of this MNDA");
  await expect(doc).toContainText("will survive in perpetuity");
});

test("a failed chat request shows an error", async ({ page }) => {
  await openApp(page);
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) => route.fulfill({ status: 500, body: "boom" }));
  await say(page, "hello");
  await expect(page.getByRole("region", { name: "Chat" }).getByRole("alert")).toContainText("something went wrong");
});

test("malicious input renders as plain text", async ({ page }) => {
  await openApp(page, [
    { reply: "ok", fields: { purpose: "# Pwned <script>window.__x=1</script> <img src=x onerror=window.__x=1>" } },
  ]);
  await say(page, "go");
  await expect(page.getByText("ok", { exact: true })).toBeVisible();
  const doc = page.getByRole("article");
  await expect(doc.getByRole("heading", { name: /Pwned/ })).toHaveCount(0);
  await expect(doc.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  await expect(doc).toContainText("# Pwned");
});

test("downloads a Markdown file with the filled-in agreement", async ({ page }) => {
  await openApp(page, [{ reply: "ok", fields: { governingLaw: "New York" } }]);
  await say(page, "New York");
  await expect(page.getByRole("article")).toContainText("laws of the State of New York");
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
  await openApp(page);
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
  await openApp(page);
  const pdf = await page.pdf({ format: "Letter" });
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
  expect(pages.length).toBeGreaterThan(2);
});

test("layout works at phone width without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openApp(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByLabel("Message")).toBeVisible();
  await expect(page.getByRole("article")).toBeVisible();
});
