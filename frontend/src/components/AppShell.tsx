"use client";

import { useState } from "react";
import { useSession } from "@/components/AuthGate";
import DocumentsPage from "@/components/DocumentsPage";
import DraftApp from "@/components/DraftApp";
import { getDocument, type SavedDocument } from "@/lib/api";
import type { DocumentSpec } from "@/lib/documents";

interface AppShellProps {
  documents: DocumentSpec[];
  templates: Record<string, string>;
}

type View = { name: "editor"; key: number; initial?: SavedDocument } | { name: "documents" };

const navButton = "rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10";

/** Top bar plus the current view: the document editor or the list of saved documents. */
export default function AppShell({ documents, templates }: AppShellProps) {
  const { email, signOut } = useSession();
  const [view, setView] = useState<View>({ name: "editor", key: 0 });
  const [error, setError] = useState<string | null>(null);

  const startNew = () => setView((v) => ({ name: "editor", key: v.name === "editor" ? v.key + 1 : Date.now() }));

  const open = async (id: number) => {
    try {
      setError(null);
      setView({ name: "editor", key: id, initial: await getDocument(id) });
    } catch {
      setError("Could not open that document.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#032147] px-4 text-white print:hidden sm:px-6">
        <span className="text-lg font-bold tracking-tight">
          Prelegal<span className="text-[#ecad0a]">.</span>
        </span>
        <nav className="flex items-center gap-1">
          <button onClick={startNew} className={navButton}>New document</button>
          <button onClick={() => setView({ name: "documents" })} className={navButton}>My documents</button>
          <span className="mx-2 hidden text-sm text-white/70 sm:inline">{email}</span>
          <button onClick={signOut} className={navButton}>Sign out</button>
        </nav>
      </header>
      {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {view.name === "documents" ? (
        <DocumentsPage documents={documents} onOpen={open} onNew={startNew} />
      ) : (
        <DraftApp key={view.key} documents={documents} templates={templates} initial={view.initial} />
      )}
    </div>
  );
}
