"use client";

import { useEffect, useState } from "react";
import { deleteDocument, listDocuments, type SavedDocument } from "@/lib/api";
import { type DocumentSpec, documentParties } from "@/lib/documents";

interface DocumentsPageProps {
  documents: DocumentSpec[];
  onOpen: (id: number) => void;
  onNew: () => void;
}

/** The server stores UTC timestamps without a zone marker; show them in the viewer's locale. */
const formatUpdated = (updatedAt: string) =>
  new Date(`${updatedAt.replace(" ", "T")}Z`).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function DocumentsPage({ documents, onOpen, onNew }: DocumentsPageProps) {
  const [saved, setSaved] = useState<SavedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  useEffect(() => {
    listDocuments().then(setSaved, () => setError("Could not load your documents."));
  }, []);

  const remove = async (id: number) => {
    try {
      await deleteDocument(id);
      setSaved((current) => current?.filter((d) => d.id !== id) ?? null);
    } catch {
      setError("Could not delete that document.");
    }
    setConfirmingId(null);
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#032147]">My documents</h1>
        <button onClick={onNew} className="rounded-md bg-[#753991] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          New document
        </button>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      {saved?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-[#888888]">
          You have not created any documents yet. Start one and it will be saved here automatically.
        </p>
      )}
      <ul className="space-y-3">
        {saved?.map((doc) => {
          const name = documents.find((d) => d.id === doc.documentType)?.name ?? doc.documentType;
          const parties = documentParties(doc.documentType, doc.fields);
          return (
            <li key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <button onClick={() => onOpen(doc.id)} aria-label={`Open ${name} ${parties}`} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-medium text-[#032147]">{name}</span>
                <span className="block truncate text-sm text-slate-600">{parties || "No parties yet"}</span>
                <span className="block text-xs text-[#888888]">Last edited {formatUpdated(doc.updatedAt)}</span>
              </button>
              {confirmingId === doc.id ? (
                <span className="flex gap-2">
                  <button onClick={() => remove(doc.id)} className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white">
                    Confirm delete
                  </button>
                  <button onClick={() => setConfirmingId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                    Cancel
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmingId(doc.id)} aria-label={`Delete ${name} ${parties}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                  Delete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
