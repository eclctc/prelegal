"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildDocument,
  defaultForm,
  localISODate,
  type NdaForm,
  type PartyInfo,
} from "@/lib/nda";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const radioLabel = "flex items-center gap-2 text-sm text-slate-800";
const MAX_YEARS = 99;

type ControlProps = { id: string; "aria-describedby"?: string };

/** Label + optional hint; the hint is announced as a description rather than part of the name. */
function Field({ label, hint, children }: { label: string; hint?: string; children: (p: ControlProps) => React.ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      {hint && <p id={hintId} className="text-xs text-slate-500">{hint}</p>}
      {children({ id, "aria-describedby": hint ? hintId : undefined })}
    </div>
  );
}

function TextField({ label, hint, value, onChange, rows }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {(p) =>
        rows ? (
          <textarea {...p} className={input} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...p} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
}

/** Whole-number input that lets the user clear the field while typing and only commits valid values. */
function YearsInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      className={`${input} !w-20`}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "").slice(0, 2);
        setText(t);
        const n = Number(t);
        if (n >= 1 && n <= MAX_YEARS) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function PartyFields({ title, value, onChange }: { title: string; value: PartyInfo; onChange: (p: PartyInfo) => void }) {
  const bind = (k: keyof PartyInfo) => ({
    value: value[k],
    onChange: (v: string) => onChange({ ...value, [k]: v }),
  });
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{title}</legend>
      <TextField label="Company" {...bind("company")} />
      <TextField label="Signatory name" {...bind("name")} />
      <TextField label="Title" {...bind("title")} />
      <TextField label="Notice address" hint="Email or postal address" {...bind("notice")} />
    </fieldset>
  );
}

function YearsChoice({ legend, name, yearsRadioLabel, years, onYears, yearsFirst, yearsLabel, yearsSuffix, other, otherLabel, yearsSelected, onSelect }: {
  legend: string;
  name: string;
  yearsRadioLabel: string;
  years: number;
  onYears: (n: number) => void;
  yearsFirst: string;
  yearsLabel: string;
  yearsSuffix: string;
  other: string;
  otherLabel: string;
  yearsSelected: boolean;
  onSelect: (yearsSelected: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className={radioLabel}>
        <input type="radio" name={name} aria-label={yearsRadioLabel} checked={yearsSelected} onChange={() => onSelect(true)} />
        {yearsFirst && <span>{yearsFirst}</span>}
        <YearsInput value={years} onChange={onYears} label={yearsLabel} />
        <span>{yearsSuffix}</span>
      </div>
      <label className={radioLabel}>
        <input type="radio" name={name} value={other} checked={!yearsSelected} onChange={() => onSelect(false)} />
        {otherLabel}
      </label>
    </fieldset>
  );
}

export default function NdaApp({ standardTerms }: { standardTerms: string }) {
  const [form, setForm] = useState<NdaForm>(() => defaultForm());
  const update = <K extends keyof NdaForm>(k: K, v: NdaForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const formId = useId();

  // Today's date depends on the viewer's clock/timezone, so set it after mount rather than
  // during the (prerendered) first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => (f.effectiveDate ? f : { ...f, effectiveDate: localISODate() }));
  }, []);

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
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[26rem_1fr] print:block print:bg-white">
      <aside className="space-y-5 border-r border-slate-200 bg-white p-6 print:hidden lg:h-screen lg:overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mutual NDA</h1>
          <p className="text-sm text-slate-500">Fill in the details; the agreement updates as you type.</p>
        </div>

        <TextField label="Purpose" hint="How Confidential Information may be used" rows={3}
          value={form.purpose} onChange={(v) => update("purpose", v)} />

        <Field label="Effective date">
          {(p) => (
            <input {...p} type="date" className={input} value={form.effectiveDate} onChange={(e) => update("effectiveDate", e.target.value)} />
          )}
        </Field>

        <YearsChoice
          legend="MNDA term" name={`${formId}-term`} yearsRadioLabel="Expires after a fixed number of years"
          yearsSelected={form.termKind === "expires"}
          onSelect={(y) => update("termKind", y ? "expires" : "continues")}
          yearsFirst="Expires after" years={form.termYears} onYears={(n) => update("termYears", n)}
          yearsLabel="MNDA term in years" yearsSuffix="year(s)"
          other="continues" otherLabel="Continues until terminated"
        />

        <YearsChoice
          legend="Term of confidentiality" name={`${formId}-conf`} yearsRadioLabel="Fixed number of years from effective date"
          yearsSelected={form.confidentialityKind === "years"}
          onSelect={(y) => update("confidentialityKind", y ? "years" : "perpetuity")}
          yearsFirst="" years={form.confidentialityYears} onYears={(n) => update("confidentialityYears", n)}
          yearsLabel="Confidentiality term in years" yearsSuffix="year(s) from effective date"
          other="perpetuity" otherLabel="In perpetuity"
        />

        <TextField label="Governing law" hint="State, e.g. Delaware"
          value={form.governingLaw} onChange={(v) => update("governingLaw", v)} />
        <TextField label="Jurisdiction" hint="City or county and state, e.g. New Castle, DE"
          value={form.jurisdiction} onChange={(v) => update("jurisdiction", v)} />
        <TextField label="Modifications" hint="Optional changes to the Standard Terms" rows={3}
          value={form.modifications} onChange={(v) => update("modifications", v)} />

        <PartyFields title="Party 1" value={form.party1} onChange={(p) => update("party1", p)} />
        <PartyFields title="Party 2" value={form.party2} onChange={(p) => update("party2", p)} />
      </aside>

      <main className="p-4 lg:h-screen lg:overflow-y-auto lg:p-8 print:block print:h-auto print:overflow-visible print:p-0">
        <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 print:hidden">
          <button onClick={download} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Download (.md)
          </button>
          <button onClick={() => window.print()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Print / Save as PDF
          </button>
        </div>
        <article aria-label="Agreement preview" className="nda mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-sm sm:p-10 print:max-w-none print:shadow-none">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </article>
        <footer className="mx-auto mt-4 max-w-3xl text-xs text-slate-500 print:hidden">
          Agreement text from{" "}
          <a className="underline" href="https://commonpaper.com/standards/mutual-nda/1.0/">Common Paper Mutual NDA v1.0</a>
          , licensed under{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Filled in with your details.
        </footer>
      </main>
    </div>
  );
}
