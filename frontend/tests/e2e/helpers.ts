import type { Page } from "@playwright/test";

export interface MockReply {
  reply: string;
  documentType?: string | null;
  fields: Record<string, unknown>;
}

export const GREETING: MockReply = { reply: "Hi! What is the purpose of the NDA?", fields: {} };

/** Serves /api/chat from a fixed queue of replies (greeting first) and records request bodies. */
export async function mockChat(page: Page, replies: MockReply[] = [], greeting: MockReply = GREETING) {
  const queue = [greeting, ...replies];
  const requests: { messages: { role: string; content: string }[]; documentType: string | null; fields: unknown }[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    const next = queue.shift() ?? { reply: "(no more mock replies)", fields: {} };
    await route.fulfill({ json: { documentType: "mutual-nda", ...next } });
  });
  return requests;
}

/** Opens the app with a mocked AI and passes the placeholder login screen. */
export async function openApp(page: Page, replies: MockReply[] = []) {
  const requests = await mockChat(page, replies);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText(GREETING.reply).waitFor();
  return requests;
}

export async function say(page: Page, text: string) {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

const party = (company: string) => ({ company, name: "Ann", title: "CEO", notice: "ann@example.com" });

/** Reply that fills every required detail. */
export const completeReply = (extra: Record<string, unknown> = {}): MockReply => ({
  reply: "All set.",
  fields: { governingLaw: "Delaware", jurisdiction: "New Castle, DE", party1: party("Acme Inc"), party2: party("Globex LLC"), ...extra },
});
