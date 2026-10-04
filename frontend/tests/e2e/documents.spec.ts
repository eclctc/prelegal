import { expect, test } from "@playwright/test";
import { mockChat, signUp } from "./helpers";

const openSelection = async (page: import("@playwright/test").Page, replies: object[]) => {
  const greeting = { reply: "What would you like to draft?", documentType: null, fields: {} };
  const requests = await mockChat(page, replies as never, greeting);
  await signUp(page);
  await page.getByText("What would you like to draft?").waitFor();
  return requests;
};

test("unsupported document request stays in selection with the AI's offer", async ({ page }) => {
  const requests = await openSelection(page, [{ reply: "I cannot draft a lease. Would a Pilot Agreement work?", documentType: null, fields: {} }]);
  await page.getByLabel("Message").fill("a lease");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Would a Pilot Agreement work?")).toBeVisible();
  expect(requests[1].documentType).toBeNull();
  await expect(page.getByRole("button", { name: "Download (.md)" })).toBeDisabled();
});

test("chosen document is drafted with a key terms table and downloaded", async ({ page }) => {
  const terms = {
    Customer: "Globex LLC", Provider: "Acme Inc", "Effective Date": "March 5, 2027", "Pilot Period": "60 days",
    "Notice Address": "legal@acme.test", "Governing Law": "Delaware", "Chosen Courts": "New Castle County, DE",
    "General Cap Amount": "$10,000",
  };
  const requests = await openSelection(page, [
    { reply: "Pilot it is. Who is the Customer?", documentType: "pilot", fields: { Provider: "Acme Inc" } },
    { reply: "All set.", documentType: "pilot", fields: terms },
  ]);
  await page.getByLabel("Message").fill("a pilot please");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("Who is the Customer?").waitFor();
  const preview = page.getByRole("article", { name: "Agreement preview" });
  await expect(preview.getByRole("heading", { name: "Pilot Agreement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download (.md)" })).toBeDisabled();

  await page.getByLabel("Message").fill("everything else");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("All set.").waitFor();
  expect(requests[2].documentType).toBe("pilot");
  await expect(preview.getByRole("cell", { name: "Globex LLC" })).toBeVisible();
  await expect(preview).not.toContainText("class=");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download (.md)" }).click()]);
  expect(download.suggestedFilename()).toBe("Pilot-Agreement.md");
});
