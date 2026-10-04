import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "@/components/DocumentsPage";
import { deleteDocument, listDocuments } from "@/lib/api";
import type { DocumentSpec } from "@/lib/documents";

vi.mock("@/lib/api", () => ({ listDocuments: vi.fn(), deleteDocument: vi.fn() }));

const documents: DocumentSpec[] = JSON.parse(readFileSync(path.join(__dirname, "../../../documents.json"), "utf8"));
const saved = [
  { id: 2, documentType: "pilot", fields: { Customer: "Globex", Provider: "Acme" }, updatedAt: "2026-10-04 15:00:00.000" },
  { id: 1, documentType: "mutual-nda", fields: { party1: { company: "Initech" }, party2: { company: "" } }, updatedAt: "2026-10-03 09:00:00.000" },
];

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("DocumentsPage", () => {
  it("lists saved documents with their type and parties", async () => {
    vi.mocked(listDocuments).mockResolvedValue(saved);
    render(<DocumentsPage documents={documents} onOpen={vi.fn()} onNew={vi.fn()} />);
    expect(await screen.findByText("Pilot Agreement")).toBeInTheDocument();
    expect(screen.getByText("Globex / Acme")).toBeInTheDocument();
    expect(screen.getByText("Mutual Non-Disclosure Agreement")).toBeInTheDocument();
    expect(screen.getByText("Initech")).toBeInTheDocument();
  });

  it("opens the chosen document", async () => {
    vi.mocked(listDocuments).mockResolvedValue(saved);
    const onOpen = vi.fn();
    render(<DocumentsPage documents={documents} onOpen={onOpen} onNew={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /Open Pilot Agreement/ }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("shows an empty state", async () => {
    vi.mocked(listDocuments).mockResolvedValue([]);
    render(<DocumentsPage documents={documents} onOpen={vi.fn()} onNew={vi.fn()} />);
    expect(await screen.findByText(/have not created any documents yet/)).toBeInTheDocument();
  });

  it("deletes only after confirmation", async () => {
    vi.mocked(listDocuments).mockResolvedValue(saved);
    vi.mocked(deleteDocument).mockResolvedValue();
    const user = userEvent.setup();
    render(<DocumentsPage documents={documents} onOpen={vi.fn()} onNew={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /Delete Pilot Agreement/ }));
    expect(deleteDocument).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(deleteDocument).toHaveBeenCalledWith(2);
    expect(screen.queryByText("Globex / Acme")).toBeNull();
  });
});
