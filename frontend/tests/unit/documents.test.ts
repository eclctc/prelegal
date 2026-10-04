import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGenericDocument, type DocumentSpec, missingGeneric, NDA_ID } from "@/lib/documents";

const root = path.join(__dirname, "../../..");
const documents: DocumentSpec[] = JSON.parse(readFileSync(path.join(root, "documents.json"), "utf8"));
const template = (d: DocumentSpec) => readFileSync(path.join(root, "templates", d.template), "utf8");
const generic = documents.filter((d) => d.id !== NDA_ID);
const filled = (d: DocumentSpec) => Object.fromEntries(d.fields.map((f) => [f.key, `Val ${f.key}`]));

describe("buildGenericDocument", () => {
  it("lists all supported documents including the NDA", () => {
    expect(documents).toHaveLength(11);
    expect(documents.map((d) => d.id)).toContain(NDA_ID);
  });

  it.each(generic.map((d) => [d.id, d] as const))("%s renders with no leftover HTML or blanks when filled", (_id, d) => {
    const md = buildGenericDocument(d, template(d), filled(d));
    expect(md).not.toMatch(/<\/?span|class="/);
    expect(md).not.toContain("[__________]");
    expect(md).toContain(`# ${d.name}`);
    for (const f of d.fields) expect(md).toContain(`| ${f.key} | Val ${f.key} |`);
  });

  it("replaces terms inline in bold, keeping possessives and aliases", () => {
    const pilot = documents.find((d) => d.id === "pilot")!;
    const md = buildGenericDocument(pilot, template(pilot), { Customer: "Globex" });
    expect(md).toContain("**Globex**");
    expect(md).toMatch(/\*\*Globex\*\*['’]s/);
    const psa = documents.find((d) => d.id === "psa")!;
    expect(buildGenericDocument(psa, template(psa), { Deliverables: "A report" })).toContain("**A report**");
  });

  it("shows blanks for missing required fields and None for empty optional ones", () => {
    const csa = documents.find((d) => d.id === "csa")!;
    const md = buildGenericDocument(csa, template(csa), {});
    expect(md).toContain("| Customer | [__________] |");
    expect(md).toContain("| Technical Support | None |");
  });

  it("escapes markdown in user-provided values", () => {
    const pilot = documents.find((d) => d.id === "pilot")!;
    const md = buildGenericDocument(pilot, template(pilot), { Customer: "<script>*x*" });
    expect(md).toContain("\\<script\\>\\*x\\*");
    expect(md).not.toContain("<script>");
  });

  it("missingGeneric returns only required fields without a value", () => {
    const pilot = documents.find((d) => d.id === "pilot")!;
    expect(missingGeneric(pilot, filled(pilot))).toEqual([]);
    expect(missingGeneric(pilot, { Customer: "  " })).toContain("Customer");
  });
});
