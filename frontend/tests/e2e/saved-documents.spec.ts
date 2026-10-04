import { expect, test } from "@playwright/test";
import { mockChat, signUp } from "./helpers";

const pilotTerms = {
  Customer: "Globex LLC", Provider: "Acme Inc", "Effective Date": "March 5, 2027", "Pilot Period": "60 days",
  "Notice Address": "legal@acme.test", "Governing Law": "Delaware", "Chosen Courts": "New Castle County, DE",
  "General Cap Amount": "$10,000",
};

const draftPilot = async (page: import("@playwright/test").Page) => {
  await mockChat(
    page,
    [
      { reply: "Pilot it is. Who is the Customer?", documentType: "pilot", fields: { Provider: "Acme Inc" } },
      { reply: "All set.", documentType: "pilot", fields: pilotTerms },
    ],
    { reply: "What would you like to draft?", documentType: null, fields: {} },
  );
  const email = await signUp(page);
  await page.getByText("What would you like to draft?").waitFor();
  for (const [message, reply] of [["a pilot", "Who is the Customer?"], ["the rest", "All set."]]) {
    await page.getByLabel("Message").fill(message);
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText(reply).waitFor();
  }
  await expect(page.getByRole("status")).toHaveText("Saved to My documents");
  return email;
};

test("a drafted document is saved, listed, reopened with its chat, and deleted", async ({ page }) => {
  await draftPilot(page);
  await page.getByRole("button", { name: "My documents" }).click();
  await expect(page.getByText("Globex LLC / Acme Inc")).toBeVisible();

  await page.getByRole("button", { name: /Open Pilot Agreement/ }).click();
  await expect(page.getByText("All set.")).toBeVisible();
  await expect(page.getByRole("article", { name: "Agreement preview" }).getByRole("cell", { name: "Globex LLC" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download (.md)" })).toBeEnabled();

  await page.getByRole("button", { name: "My documents" }).click();
  await page.getByRole("button", { name: /Delete Pilot Agreement/ }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText(/have not created any documents yet/)).toBeVisible();
});

test("saved documents are still there after signing out and back in, and are private to the user", async ({ page, browser }) => {
  const email = await draftPilot(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "My documents" }).click();
  await expect(page.getByText("Globex LLC / Acme Inc")).toBeVisible();

  const other = await browser.newPage();
  await signUp(other);
  await other.getByRole("button", { name: "My documents" }).click();
  await expect(other.getByText(/have not created any documents yet/)).toBeVisible();
  await other.close();
});

test("the draft disclaimer is in the preview and the downloaded file", async ({ page }) => {
  await draftPilot(page);
  const preview = page.getByRole("article", { name: "Agreement preview" });
  await expect(preview).toContainText("Draft for review");
  await expect(preview).toContainText("subject to review by a qualified attorney");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download (.md)" }).click()]);
  const text = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
  expect(text).toContain("subject to review by a qualified attorney");
});
