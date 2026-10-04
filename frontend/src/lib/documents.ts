import { clean } from "@/lib/nda";

export interface FieldSpec {
  key: string;
  hint: string;
  optional?: boolean;
  aliases?: string[];
}

export interface DocumentSpec {
  id: string;
  name: string;
  template: string;
  description: string;
  fields: FieldSpec[];
}

export type Values = Record<string, string>;

export const NDA_ID = "mutual-nda";

const POSSESSIVE = /[’']s$/;
const LINK_SPAN = /<span class="\w+_link">([^<]+)<\/span>/g;
const HEADER_SPAN = /<span class="header_\d"[^>]*>([^<]*)<\/span>/g;
const OTHER_SPAN = /<\/?span[^>]*>/g;

const blank = "[__________]";

/** Display text for a field: its value, "None" when an optional field is empty, else a blank. */
function shown(field: FieldSpec, values: Values): string {
  const value = values[field.key]?.trim();
  if (value) return clean(value);
  return field.optional ? "None" : blank;
}

/** Labels of the required fields that have no value yet. */
export function missingGeneric(spec: DocumentSpec, values: Values): string[] {
  return spec.fields.filter((f) => !f.optional && !values[f.key]?.trim()).map((f) => f.key);
}

/**
 * Fills a Common Paper template that has no cover page: a generated Key Terms table, then the
 * template body with each defined-term span replaced by the bold value (unknown terms keep their label).
 */
export function buildGenericDocument(spec: DocumentSpec, template: string, values: Values): string {
  const byTerm = new Map(spec.fields.flatMap((f) => [f.key, ...(f.aliases ?? [])].map((t) => [t, f] as const)));
  const rows = spec.fields.map((f) => `| ${f.key} | ${shown(f, values)} |`).join("\n");
  const body = template
    .replace(/^# .*\n/, "## Standard Terms\n")
    .replace(LINK_SPAN, (_, text: string) => {
      const term = text.replace(POSSESSIVE, "");
      const field = byTerm.get(term);
      return field ? `**${shown(field, values)}**${text.slice(term.length)}` : text;
    })
    .replace(HEADER_SPAN, "**$1**")
    .replace(OTHER_SPAN, "");
  return `# ${spec.name}\n\n## Key Terms\n\n| Term | Value |\n|:--- |:--- |\n${rows}\n\n---\n\n${body}\n`;
}
