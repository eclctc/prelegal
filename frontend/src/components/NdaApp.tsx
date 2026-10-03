"use client";

import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildDocument,
  defaultForm,
  type NdaForm,
  type PartyInfo,
} from "@/lib/nda";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      {children}
    </label>
  );
}

function PartyFields({ title, value, onChange }: { title: string; value: PartyInfo; onChange: (p: PartyInfo) => void }) {
  const set = (k: keyof PartyInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      <Field label="Company"><input className={input} value={value.company} onChange={set("company")} /></Field>
      <Field label="Signatory name"><input className={input} value={value.name} onChange={set("name")} /></Field>
      <Field label="Title"><input className={input} value={value.title} onChange={set("title")} /></Field>
      <Field label="Notice address" hint="Email or postal address">
        <input className={input} value={value.notice} onChange={set("notice")} />
      </Field>
    </fieldset>
  );
}

export default function NdaApp({ standardTerms }: { standardTerms: string }) {
  const [form, setForm] = useState<NdaForm>(() => defaultForm());
  const update = <K extends keyof NdaForm>(k: K, v: NdaForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const markdown = useMemo(() => buildDocument(standardTerms, form), [standardTerms, form]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mutual-NDA.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[26rem_1fr]">
      <aside className="space-y-5 border-r border-slate-200 bg-white p-6 print:hidden lg:h-screen lg:overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mutual NDA</h1>
          <p className="text-sm text-slate-500">Fill in the details; the agreement updates as you type.</p>
        </div>

        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea className={input} rows={3} value={form.purpose} onChange={(e) => update("purpose", e.target.value)} />
        </Field>

        <Field label="Effective date">
          <input type="date" className={input} value={form.effectiveDate} onChange={(e) => update("effectiveDate", e.target.value)} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">MNDA term</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={form.termKind === "expires"} onChange={() => update("termKind", "expires")} />
            Expires after
            <input type="number" min={1} className={`${input} !w-20`} value={form.termYears}
              onChange={(e) => update("termYears", Math.max(1, Number(e.target.value) || 1))} />
            year(s)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={form.termKind === "continues"} onChange={() => update("termKind", "continues")} />
            Continues until terminated
          </label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">Term of confidentiality</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={form.confidentialityKind === "years"} onChange={() => update("confidentialityKind", "years")} />
            <input type="number" min={1} className={`${input} !w-20`} value={form.confidentialityYears}
              onChange={(e) => update("confidentialityYears", Math.max(1, Number(e.target.value) || 1))} />
            year(s) from effective date
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={form.confidentialityKind === "perpetuity"} onChange={() => update("confidentialityKind", "perpetuity")} />
            In perpetuity
          </label>
        </fieldset>

        <Field label="Governing law" hint="State, e.g. Delaware">
          <input className={input} value={form.governingLaw} onChange={(e) => update("governingLaw", e.target.value)} />
        </Field>
        <Field label="Jurisdiction" hint="City or county and state, e.g. New Castle, DE">
          <input className={input} value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)} />
        </Field>
        <Field label="Modifications" hint="Optional changes to the Standard Terms">
          <textarea className={input} rows={3} value={form.modifications} onChange={(e) => update("modifications", e.target.value)} />
        </Field>

        <PartyFields title="Party 1" value={form.party1} onChange={(p) => update("party1", p)} />
        <PartyFields title="Party 2" value={form.party2} onChange={(p) => update("party2", p)} />
      </aside>

      <main className="p-4 lg:h-screen lg:overflow-y-auto lg:p-8 print:p-0">
        <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 print:hidden">
          <button onClick={download} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Download (.md)
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Print / Save as PDF
          </button>
        </div>
        <article className="nda mx-auto max-w-3xl rounded-lg bg-white p-10 shadow-sm print:max-w-none print:shadow-none">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </article>
      </main>
    </div>
  );
}
