export type TermKind = "expires" | "continues";
export type ConfidentialityKind = "years" | "perpetuity";

export interface NdaForm {
  purpose: string;
  effectiveDate: string; // yyyy-mm-dd
  termKind: TermKind;
  termYears: number;
  confidentialityKind: ConfidentialityKind;
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: PartyInfo;
  party2: PartyInfo;
}

export interface PartyInfo {
  name: string;
  title: string;
  company: string;
  notice: string;
}

const party = (): PartyInfo => ({ name: "", title: "", company: "", notice: "" });

/** Local calendar date as yyyy-mm-dd (toISOString would give the UTC date). */
export function localISODate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `today` is optional: without it the date is left blank so server and client renders agree. */
export function defaultForm(today?: Date): NdaForm {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: today ? localISODate(today) : "",
    termKind: "expires",
    termYears: 1,
    confidentialityKind: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: party(),
    party2: party(),
  };
}

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m > 12 || d > 31) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const blank = "[__________]";

// Keep user text from being parsed as markdown: escape inline syntax everywhere and
// block markers (#, >, -, +, "1.") at the start of each line.
const escLine = (v: string) =>
  v
    .trim()
    .replace(/([\\`*_{}[\]<>|~])/g, "\\$1")
    .replace(/^([#>+-])/, "\\$1")
    .replace(/^(\d+)([.)])/, "$1\\$2");
/** Single-line escaped text (newlines collapsed), or the blank placeholder when empty. */
const clean = (v: string) => escLine(v.replace(/\s*\n\s*/g, " ")) || blank;
/** Multi-line escaped text keeping each line as its own paragraph. */
const cleanBlock = (v: string) =>
  v.split(/\r?\n/).map(escLine).filter(Boolean).join("\n\n") || blank;

/** The Standard Terms already say "the State of ___", so accept "Delaware" or "State of Delaware". */
const stateName = (v: string) => v.trim().replace(/^(the\s+)?state\s+of\s+/i, "");

export function termText(f: NdaForm): string {
  return f.termKind === "expires"
    ? `${years(f.termYears)} from Effective Date`
    : "until terminated in accordance with the terms of the MNDA";
}

export function confidentialityText(f: NdaForm): string {
  return f.confidentialityKind === "years"
    ? `${years(f.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws`
    : "in perpetuity";
}

const checkbox = (on: boolean, text: string) => `- [${on ? "x" : " "}] ${text}`;

/** Fills the Common Paper cover page from the form values. */
export function buildCoverPage(f: NdaForm): string {
  const cell = (a: string, b: string) => `| ${clean(a)} | ${clean(b)} |`;
  const row = (label: string, k: keyof PartyInfo) =>
    `| ${label} ${cell(f.party1[k], f.party2[k])}`;
  const mods = f.modifications.trim() ? cleanBlock(f.modifications) : "None.";
  const y = (n: number) => `${n} year(s)`;

  return `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
*How Confidential Information may be used*

${cleanBlock(f.purpose)}

### Effective Date
${formatDate(f.effectiveDate) || blank}

### MNDA Term
*The length of this MNDA*

${checkbox(f.termKind === "expires", `Expires ${f.termKind === "expires" ? y(f.termYears) : "[1 year(s)]"} from Effective Date.`)}
${checkbox(f.termKind === "continues", "Continues until terminated in accordance with the terms of the MNDA.")}

### Term of Confidentiality
*How long Confidential Information is protected*

${checkbox(f.confidentialityKind === "years", `${f.confidentialityKind === "years" ? y(f.confidentialityYears) : "[1 year(s)]"} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`)}
${checkbox(f.confidentialityKind === "perpetuity", "In perpetuity.")}

### Governing Law & Jurisdiction
Governing Law: ${clean(stateName(f.governingLaw))}

Jurisdiction: ${clean(f.jurisdiction)}

### MNDA Modifications
*List any modifications to the MNDA*

${mods}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|  | PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
| Signature | | |
${row("Print Name", "name")}
${row("Title", "title")}
${row("Company", "company")}
${row("Notice Address (use either email or postal address)", "notice")}
| Date | | |

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`;
}

const SPAN = /<span class="coverpage_link">([^<]+)<\/span>/g;

/**
 * Fills the Standard Terms from the form. Two clauses depend on the option chosen, so they are
 * rewritten as whole phrases (otherwise "continues until terminated" or "in perpetuity" would be
 * dropped into "expires at the end of the ..." and read as nonsense).
 */
export function buildStandardTerms(template: string, f: NdaForm): string {
  const bold = (v: string) => `**${v}**`;
  const span = (key: string) => `<span class="coverpage_link">${key}</span>`;

  const mnda =
    f.termKind === "expires"
      ? `expires ${bold(`${years(f.termYears)} after the Effective Date`)}`
      : `continues ${bold("until terminated in accordance with the terms of this MNDA")}`;
  const survive =
    f.confidentialityKind === "years"
      ? `survive for ${bold(confidentialityText(f))}`
      : `survive ${bold("in perpetuity")}`;

  const values: Record<string, string> = {
    Purpose: f.purpose.replace(/\s*\n\s*/g, " ").trim().replace(/\.$/, ""),
    "Effective Date": formatDate(f.effectiveDate),
    "Governing Law": stateName(f.governingLaw),
    Jurisdiction: f.jurisdiction,
  };

  return template
    .replace(`expires at the end of the ${span("MNDA Term")}`, () => mnda)
    .replace(`survive for the ${span("Term of Confidentiality")}`, () => survive)
    .replace(SPAN, (_, key: string) =>
      key in values ? bold(clean(values[key])) : key, // unknown links fall back to their label
    );
}

export function buildDocument(template: string, f: NdaForm): string {
  return `${buildCoverPage(f)}\n\n---\n\n${buildStandardTerms(template, f)}\n`;
}
