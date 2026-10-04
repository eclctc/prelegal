import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DraftApp from "@/components/DraftApp";
import type { DocumentSpec } from "@/lib/documents";
import { sendChat } from "@/lib/chat";

vi.mock("@/lib/chat", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/chat")>()),
  sendChat: vi.fn(),
}));

const root = path.join(__dirname, "../../..");
const documents: DocumentSpec[] = JSON.parse(readFileSync(path.join(root, "documents.json"), "utf8"));
const templates = Object.fromEntries(
  documents.map((d) => [d.id, readFileSync(path.join(root, "templates", d.template), "utf8")]),
);
const mockSendChat = vi.mocked(sendChat);
const party = (company: string) => ({ company, name: "Ann", title: "CEO", notice: "ann@example.com" });
const completeFields = { governingLaw: "Delaware", jurisdiction: "New Castle, DE", party1: party("Acme Inc"), party2: party("Globex LLC") };
const greeting = { documentType: "mutual-nda", reply: "Hi! What is the purpose of the NDA?", fields: {} };

const setup = async () => {
  const user = userEvent.setup();
  render(<DraftApp documents={documents} templates={templates} />);
  await screen.findByText(greeting.reply);
  const preview = () => screen.getByRole("article", { name: "Agreement preview" });
  return { user, preview };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 21, 30));
  mockSendChat.mockReset();
  mockSendChat.mockResolvedValueOnce(greeting);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("DraftApp chat (Mutual NDA)", () => {
  it("opens the conversation with an AI greeting using a hidden opening message", async () => {
    await setup();
    const [sent, documentType, fields] = mockSendChat.mock.calls[0];
    expect(sent).toHaveLength(1);
    expect(sent[0].role).toBe("user");
    expect(documentType).toBeNull();
    expect(fields).toEqual({});
    expect(screen.queryByText(sent[0].content)).toBeNull();
  });

  it("returns focus to the message input after the AI replies to a button click", async () => {
    const { user } = await setup();
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "Noted.", fields: {} });
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Noted.");
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("sends the user's reply with history and fills the preview from the AI's fields", async () => {
    const { user, preview } = await setup();
    mockSendChat.mockResolvedValueOnce({
      documentType: "mutual-nda", reply: "Noted Delaware.",
      fields: { governingLaw: "Delaware", party1: { company: "Acme Inc" } },
    });
    await user.type(screen.getByLabelText("Message"), "Delaware law, I am Acme Inc");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Noted Delaware.")).toBeInTheDocument();
    const history = mockSendChat.mock.calls[1][0];
    expect(history.map((m) => m.content)).toContain(greeting.reply);
    expect(history.at(-1)).toEqual({ role: "user", content: "Delaware law, I am Acme Inc" });
    expect(preview()).toHaveTextContent("Governing Law: Delaware");
    expect(within(within(preview()).getByRole("table")).getByRole("row", { name: /Company/ })).toHaveTextContent("Acme Inc");
  });

  it("defaults the effective date to today and shows placeholders", async () => {
    const { preview } = await setup();
    expect(preview()).toHaveTextContent("October 3, 2026");
    expect(preview()).toHaveTextContent("Governing Law: [__________]");
  });

  it("shows an error and recovers when the request fails", async () => {
    const { user } = await setup();
    mockSendChat.mockRejectedValueOnce(new Error("boom"));
    await user.type(screen.getByLabelText("Message"), "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("something went wrong");
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "Back again.", fields: {} });
    await user.type(screen.getByLabelText("Message"), "retry");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Back again.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not render AI-supplied headings, HTML or table breakouts as markup", async () => {
    const { user, preview } = await setup();
    mockSendChat.mockResolvedValueOnce({
      documentType: "mutual-nda", reply: "ok",
      fields: { purpose: "# Pwned <img src=x>", party1: { company: "A | B" } },
    });
    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    expect(within(preview()).queryByRole("heading", { name: /Pwned/ })).toBeNull();
    expect(preview().querySelector("img")).toBeNull();
    const row = within(within(preview()).getByRole("table")).getByRole("row", { name: /Company/ });
    expect(within(row).getAllByRole("cell")).toHaveLength(3);
  });

  it("applies term choices from the AI to the agreement text", async () => {
    const { user, preview } = await setup();
    mockSendChat.mockResolvedValueOnce({
      documentType: "mutual-nda", reply: "ok",
      fields: { termKind: "continues", confidentialityKind: "perpetuity" },
    });
    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    expect(preview()).toHaveTextContent("and continues until terminated in accordance with the terms of this MNDA.");
    expect(preview()).toHaveTextContent("will survive in perpetuity");
  });

  it("downloads the filled markdown as Mutual-NDA.md", async () => {
    const { user } = await setup();
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "ok", fields: completeFields });
    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    let blob: Blob | undefined;
    const create = vi.fn((b: Blob) => ((blob = b), "blob:test"));
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("Mutual-NDA.md");
    });
    await user.click(screen.getByRole("button", { name: /Download/ }));
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:test");
    const text = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsText(blob!);
    });
    expect(text).toContain("Governing Law: Delaware");
    click.mockRestore();
  });

  it("opens the print dialog from the Print button", async () => {
    const { user } = await setup();
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "ok", fields: completeFields });
    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: /Print/ }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("disables download and print and lists what is missing until the form is complete", async () => {
    const { user } = await setup();
    const download = screen.getByRole("button", { name: /Download/ });
    const print = screen.getByRole("button", { name: /Print/ });
    expect(download).toBeDisabled();
    expect(print).toBeDisabled();
    expect(screen.getByText(/Still needed before you can download/)).toHaveTextContent("Governing law, Jurisdiction, Party 1 company");
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "ok", fields: { ...completeFields, party2: { name: "Ann", title: "CEO", notice: "ann@example.com" } } });
    await user.type(screen.getByLabelText("Message"), "go");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    expect(download).toBeDisabled();
    expect(screen.getByText(/Still needed/)).toHaveTextContent("Party 2 company");
    mockSendChat.mockResolvedValueOnce({ documentType: "mutual-nda", reply: "done", fields: { party2: { company: "Globex LLC" } } });
    await user.type(screen.getByLabelText("Message"), "Globex");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("done");
    expect(download).toBeEnabled();
    expect(print).toBeEnabled();
    expect(screen.queryByText(/Still needed/)).toBeNull();
  });

  it("credits Common Paper under CC BY 4.0", async () => {
    await setup();
    expect(screen.getByRole("link", { name: "Common Paper" })).toHaveAttribute("href", expect.stringContaining("commonpaper.com"));
  });
});

describe("DraftApp document selection", () => {
  const openSelection = async () => {
    mockSendChat.mockReset();
    mockSendChat.mockResolvedValueOnce({ documentType: null, reply: "What would you like to draft?", fields: {} });
    const user = userEvent.setup();
    render(<DraftApp documents={documents} templates={templates} />);
    await screen.findByText("What would you like to draft?");
    return user;
  };
  const say = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByLabelText("Message"), text);
    await user.click(screen.getByRole("button", { name: "Send" }));
  };

  it("shows no agreement and disables download until a document is chosen", async () => {
    await openSelection();
    expect(screen.getByText(/appear here once you have chosen a document/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download (.md)" })).toBeDisabled();
  });

  it("keeps selection open when the AI offers an alternative to an unsupported document", async () => {
    const user = await openSelection();
    mockSendChat.mockResolvedValueOnce({ documentType: null, reply: "No leases; try a Pilot Agreement?", fields: {} });
    await say(user, "a lease");
    await screen.findByText("No leases; try a Pilot Agreement?");
    expect(mockSendChat.mock.calls[1][1]).toBeNull();
    expect(screen.getByRole("heading", { name: "Legal documents" })).toBeInTheDocument();
  });

  it("switches to the chosen document, fills its key terms and enables download when complete", async () => {
    const user = await openSelection();
    const pilot = documents.find((d) => d.id === "pilot")!;
    const all = Object.fromEntries(pilot.fields.map((f) => [f.key, `v-${f.key}`]));
    mockSendChat.mockResolvedValueOnce({ documentType: "pilot", reply: "Who is the Customer?", fields: { Customer: "Globex" } });
    await say(user, "a pilot");
    await screen.findByText("Who is the Customer?");
    expect(screen.getAllByRole("heading", { name: "Pilot Agreement" })).toHaveLength(2);
    expect(screen.getAllByText("Globex").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Download (.md)" })).toBeDisabled();

    mockSendChat.mockResolvedValueOnce({ documentType: "pilot", reply: "All set.", fields: all });
    await say(user, "everything");
    await screen.findByText("All set.");
    expect(mockSendChat.mock.calls[2][1]).toBe("pilot");
    expect(mockSendChat.mock.calls[2][2]).toMatchObject({ Customer: "Globex" });
    expect(screen.getByRole("button", { name: "Download (.md)" })).toBeEnabled();
  });
});
