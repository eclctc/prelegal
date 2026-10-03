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

const emptyParty: PartyInfo = { name: "", title: "", company: "", notice: "" };

export function defaultForm(today = new Date()): NdaForm {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: today.toISOString().slice(0, 10),
    termKind: "expires",
    termYears: 1,
    confidentialityKind: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { ...emptyParty },
    party2: { ...emptyParty },
  };
}

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const blank = "[__________]";
const orBlank = (v: string) => v.trim() || blank;
// Keep user text from being parsed as markdown structure.
const esc = (v: string) => v.replace(/([\\`*_{}[\]<>|])/g, "\\$1").replace(/\n+/g, " ");

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

/** Fills the Common Paper cover page from the form values. */
export function buildCoverPage(f: NdaForm): string {
  const cell = (a: string, b: string) => `| ${orBlank(esc(a))} | ${orBlank(esc(b))} |`;
  const row = (label: string, k: keyof PartyInfo) =>
    `| ${label} ${cell(f.party1[k], f.party2[k])}`;
  const mods = f.modifications.trim() ? esc(f.modifications) : "None.";

  return `# Mutual Non-Disclosure Agreement

## Using this Mutual Non-Disclosure Agreement

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
*How Confidential Information may be used*

${orBlank(esc(f.purpose))}

### Effective Date
${formatDate(f.effectiveDate) || blank}

### MNDA Term
*The length of this MNDA*

${f.termKind === "expires" ? `Expires ${termText(f)}.` : `Continues ${termText(f)}.`}

### Term of Confidentiality
*How long Confidential Information is protected*

${confidentialityText(f)[0].toUpperCase() + confidentialityText(f).slice(1)}.

### Governing Law & Jurisdiction
Governing Law: ${orBlank(esc(f.governingLaw))}

Jurisdiction: ${orBlank(esc(f.jurisdiction))}

### MNDA Modifications
${mods}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|  | PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
| Signature | | |
${row("Print Name", "name")}
${row("Title", "title")}
${row("Company", "company")}
${row("Notice Address", "notice")}
| Date | | |

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`;
}

/** Replaces the `coverpage_link` spans in the Standard Terms with the chosen values. */
export function buildStandardTerms(template: string, f: NdaForm): string {
  const values: Record<string, string> = {
    Purpose: f.purpose.trim().replace(/\.$/, ""),
    "Effective Date": formatDate(f.effectiveDate),
    "MNDA Term": termText(f),
    "Term of Confidentiality": confidentialityText(f),
    "Governing Law": f.governingLaw.trim(),
    Jurisdiction: f.jurisdiction.trim(),
  };
  return template.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    (_, key: string) => `**${esc(values[key] || "") || blank}**`,
  );
}

export function buildDocument(template: string, f: NdaForm): string {
  return `${buildCoverPage(f)}\n\n---\n\n${buildStandardTerms(template, f)}\n`;
}
