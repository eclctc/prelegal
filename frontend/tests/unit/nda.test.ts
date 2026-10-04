import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCoverPage,
  buildDocument,
  buildStandardTerms,
  confidentialityText,
  defaultForm,
  formatDate,
  localISODate,
  missingFields,
  termText,
  type NdaForm,
} from "@/lib/nda";

const templatesDir = path.join(__dirname, "../../../templates");
const template = readFileSync(path.join(templatesDir, "Mutual-NDA.md"), "utf8");
const coverTemplate = readFileSync(path.join(templatesDir, "Mutual-NDA-coverpage.md"), "utf8");

const filled = (over: Partial<NdaForm> = {}): NdaForm => ({
  ...defaultForm(new Date(2026, 2, 5, 12)),
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  ...over,
});

describe("defaultForm", () => {
  it("uses the supplied date as an ISO yyyy-mm-dd string", () => {
    expect(defaultForm(new Date(2026, 2, 5, 12)).effectiveDate).toBe("2026-03-05");
  });
  it("leaves the date blank when none is supplied (keeps SSR deterministic)", () => {
    expect(defaultForm().effectiveDate).toBe("");
  });
  it("returns independent party objects", () => {
    const f = defaultForm();
    f.party1.name = "A";
    expect(f.party2.name).toBe("");
    expect(defaultForm().party1.name).toBe("");
  });
  it("defaults match the Common Paper cover page defaults", () => {
    const f = defaultForm();
    expect(f.purpose).toBe("Evaluating whether to enter into a business relationship with the other party.");
    expect([f.termKind, f.termYears]).toEqual(["expires", 1]);
    expect([f.confidentialityKind, f.confidentialityYears]).toEqual(["years", 1]);
  });
});

describe("localISODate", () => {
  it("uses the local calendar day, not the UTC day", () => {
    // 23:30 local on Mar 5 is already Mar 6 in UTC for any zone behind UTC.
    expect(localISODate(new Date(2026, 2, 5, 23, 30))).toBe("2026-03-05");
    expect(localISODate(new Date(2026, 2, 5, 0, 5))).toBe("2026-03-05");
  });
  it("zero-pads month and day", () => {
    expect(localISODate(new Date(2026, 0, 2))).toBe("2026-01-02");
  });
});

describe("formatDate", () => {
  it("formats long US style without timezone drift", () => {
    expect(formatDate("2026-03-05")).toBe("March 5, 2026");
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("2026-12-31")).toBe("December 31, 2026");
  });
  it("handles leap day", () => {
    expect(formatDate("2028-02-29")).toBe("February 29, 2028");
  });
  it("returns empty string for empty or invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("garbage")).toBe("");
    expect(formatDate("2026-13")).toBe("");
    expect(formatDate("2026-13-01")).toBe("");
    expect(formatDate("2026-01-32")).toBe("");
  });
});

describe("termText / confidentialityText", () => {
  it("pluralises years", () => {
    expect(termText(filled({ termYears: 1 }))).toBe("1 year from Effective Date");
    expect(termText(filled({ termYears: 2 }))).toBe("2 years from Effective Date");
  });
  it("describes a continuing term", () => {
    expect(termText(filled({ termKind: "continues" }))).toBe(
      "until terminated in accordance with the terms of the MNDA",
    );
  });
  it("keeps the trade secret carve-out for fixed confidentiality terms", () => {
    expect(confidentialityText(filled({ confidentialityYears: 3 }))).toBe(
      "3 years from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws",
    );
  });
  it("supports perpetuity", () => {
    expect(confidentialityText(filled({ confidentialityKind: "perpetuity" }))).toBe("in perpetuity");
  });
});

describe("buildCoverPage", () => {
  it("renders every chosen value", () => {
    const md = buildCoverPage(
      filled({
        purpose: "Exploring a partnership.",
        modifications: "Section 3 is deleted.",
        party1: { name: "Ann", title: "CEO", company: "Acme", notice: "ann@acme.com" },
        party2: { name: "Bob", title: "CTO", company: "Globex", notice: "1 Main St" },
      }),
    );
    for (const s of [
      "Exploring a partnership.",
      "March 5, 2026",
      "- [x] Expires 1 year(s) from Effective Date.",
      "Governing Law: Delaware",
      "Jurisdiction: New Castle, DE",
      "Section 3 is deleted.",
      "| Print Name | Ann | Bob |",
      "| Title | CEO | CTO |",
      "| Company | Acme | Globex |",
      "| Notice Address (use either email or postal address) | ann@acme.com | 1 Main St |",
    ]) expect(md).toContain(s);
  });

  it("uses placeholders for blank fields and 'None.' for no modifications", () => {
    const md = buildCoverPage(defaultForm());
    expect(md).toContain("Governing Law: [__________]");
    expect(md).toContain("| Company | [__________] | [__________] |");
    expect(md).toMatch(/### MNDA Modifications\n\*List any modifications to the MNDA\*\n\nNone\./);
  });

  it("treats whitespace-only values as blank", () => {
    const md = buildCoverPage(filled({ governingLaw: "   ", purpose: "  " }));
    expect(md).toContain("Governing Law: [__________]");
    expect(md).toMatch(/### Purpose\n.*\n\n\[__________\]/);
  });

  it("renders the continuing-term and perpetuity variants", () => {
    const md = buildCoverPage(filled({ termKind: "continues", confidentialityKind: "perpetuity" }));
    expect(md).toContain("- [x] Continues until terminated in accordance with the terms of the MNDA.");
    expect(md).toContain("- [x] In perpetuity.");
    expect(md).toContain("- [ ] Expires [1 year(s)] from Effective Date.");
    expect(md).toContain("- [ ] [1 year(s)] from Effective Date, but in the case of trade secrets");
  });

  it("shows both options with exactly one checked for each choice", () => {
    for (const over of [{}, { termKind: "continues" as const }, { confidentialityKind: "perpetuity" as const }]) {
      const md = buildCoverPage(filled(over));
      const term = md.split("### MNDA Term")[1].split("###")[0];
      const conf = md.split("### Term of Confidentiality")[1].split("###")[0];
      for (const section of [term, conf]) {
        expect(section.match(/^- \[x\]/gm)).toHaveLength(1);
        expect(section.match(/^- \[ \]/gm)).toHaveLength(1);
      }
    }
  });

  it("writes the chosen number of years into the checked option", () => {
    const md = buildCoverPage(filled({ termYears: 4, confidentialityYears: 7 }));
    expect(md).toContain("- [x] Expires 4 year(s) from Effective Date.");
    expect(md).toContain("- [x] 7 year(s) from Effective Date, but");
  });

  it("strips a leading 'State of' from the governing law", () => {
    expect(buildCoverPage(filled({ governingLaw: "State of Delaware" }))).toContain("Governing Law: Delaware");
    expect(buildCoverPage(filled({ governingLaw: "the state of New York" }))).toContain("Governing Law: New York");
    expect(buildCoverPage(filled({ governingLaw: "Stateville" }))).toContain("Governing Law: Stateville");
  });

  it("keeps the template's headings, intro and attribution (drift guard)", () => {
    const md = buildCoverPage(filled());
    const intro = coverTemplate.split("\n").find((l) => l.startsWith("This Mutual Non-Disclosure Agreement"))!;
    const attribution = coverTemplate.trim().split("\n").pop()!;
    expect(md).toContain(intro);
    expect(md).toContain(attribution);
    for (const h of coverTemplate.match(/^#{1,3} .+$/gm)!) {
      expect(md.toLowerCase()).toContain(h.toLowerCase());
    }
    expect(md).toContain("## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT");
  });

  describe("multi-line fields", () => {
    it("keeps each modification line as its own paragraph", () => {
      const md = buildCoverPage(filled({ modifications: "1. Term is 2 years\n2. Law is NY" }));
      expect(md).toContain("1\\. Term is 2 years\n\n2\\. Law is NY");
    });
    it("ignores blank lines and CRLF", () => {
      const md = buildCoverPage(filled({ modifications: "a\r\n\r\n\r\nb" }));
      expect(md).toContain("a\n\nb");
    });
    it("treats a whitespace-only modification as none", () => {
      expect(buildCoverPage(filled({ modifications: " \n " }))).toContain("None.");
    });
  });

  it("includes the CC BY 4.0 attribution", () => {
    expect(buildCoverPage(filled())).toContain("CC BY 4.0");
  });

  describe("markdown safety", () => {
    it("escapes pipes so table cells cannot break out", () => {
      const md = buildCoverPage(filled({ party1: { name: "A | B", title: "", company: "", notice: "" } }));
      const row = md.split("\n").find((l) => l.startsWith("| Print Name"))!;
      // 3 columns => 4 unescaped pipes
      expect(row.replace(/\\\|/g, "").match(/\|/g)).toHaveLength(4);
    });
    it("collapses newlines in table cells and single-line fields", () => {
      const md = buildCoverPage(filled({ party2: { name: "x\ny", title: "", company: "", notice: "l1\n\nl2" } }));
      expect(md).toContain("| Print Name | [__________] | x y |");
      expect(md).toContain("l1 l2");
    });
    it("escapes raw HTML and markdown emphasis characters", () => {
      const md = buildCoverPage(filled({ governingLaw: "<script>alert(1)</script> *bold* _it_" }));
      expect(md).not.toContain("<script>");
      expect(md).toContain("\\*bold\\*");
    });
    it.each(["# Heading", "- item", "+ item", "> quote", "1. item", "2) item"])(
      "escapes the leading block marker in %j",
      (purpose) => {
        const md = buildCoverPage(filled({ purpose }));
        expect(md).toContain(purpose.replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([#>+-])/, "\\$1"));
        expect(md).not.toMatch(new RegExp(`^${purpose.replace(/[+)]/g, "\\$&")}$`, "m"));
      },
    );
    it("escapes strikethrough and backslashes", () => {
      const md = buildCoverPage(filled({ governingLaw: "~~x~~ a\\b" }));
      expect(md).toContain("\\~\\~x\\~\\~ a\\\\b");
    });
    it("escapes a horizontal rule", () => {
      const mods = buildCoverPage(filled({ modifications: "---" })).split("### MNDA Modifications")[1].split("By signing")[0];
      expect(mods).toContain("\\---");
    });
  });
});

describe("buildStandardTerms", () => {
  it("replaces every coverpage_link span", () => {
    const out = buildStandardTerms(template, filled());
    expect(out).not.toContain("coverpage_link");
    expect(out).not.toContain("<span");
  });

  it("substitutes each value in the right clause", () => {
    const out = buildStandardTerms(template, filled({ purpose: "Testing things." }));
    expect(out).toContain("in connection with the **Testing things**");
    expect(out).toContain("commences on the **March 5, 2026**");
    expect(out).toContain("laws of the State of **Delaware**");
    expect(out).toContain("courts located in **New Castle, DE**");
  });

  describe("Section 5 term clauses read as grammatical English", () => {
    const sec5 = (f: NdaForm) => buildStandardTerms(template, f).split("\n").find((l) => l.startsWith("5."))!;
    it("fixed term", () => {
      const s5 = sec5(filled({ termYears: 2, confidentialityYears: 3 }));
      expect(s5).toContain("and expires **2 years after the Effective Date**.");
      expect(s5).toContain("will survive for **3 years from Effective Date, but in the case of trade secrets");
    });
    it("continuing term", () => {
      const s5 = sec5(filled({ termKind: "continues" }));
      expect(s5).toContain("and continues **until terminated in accordance with the terms of this MNDA**.");
      expect(s5).not.toContain("expires");
    });
    it("perpetual confidentiality", () => {
      const s5 = sec5(filled({ confidentialityKind: "perpetuity" }));
      expect(s5).toContain("will survive **in perpetuity**");
      expect(s5).not.toContain("survive for");
    });
    it("never leaves the words 'the in' / 'the until' / 'end of the 1'", () => {
      for (const over of [{}, { termKind: "continues" as const }, { confidentialityKind: "perpetuity" as const }]) {
        const s5 = sec5(filled(over));
        expect(s5).not.toMatch(/the \*{0,2}(in perpetuity|until terminated)/);
        expect(s5).not.toMatch(/end of the \*{0,2}\d/);
      }
    });
    it("falls back to the label for an unknown link, never raw HTML", () => {
      expect(buildStandardTerms('see <span class="coverpage_link">Other Thing</span>.', filled())).toBe("see Other Thing.");
    });
  });

  it("accepts 'State of X' in governing law without doubling it", () => {
    const out = buildStandardTerms(template, filled({ governingLaw: "State of Delaware" }));
    expect(out).toContain("laws of the State of **Delaware**");
  });

  it("flattens newlines in the purpose inside the sentence", () => {
    const out = buildStandardTerms(template, filled({ purpose: "line one\nline two." }));
    expect(out).toContain("**line one line two**");
  });

  it("strips one trailing period from the purpose so the sentence reads correctly", () => {
    const out = buildStandardTerms(template, filled({ purpose: "Evaluating a deal." }));
    expect(out).toContain("solely for the **Evaluating a deal**");
    expect(out).not.toContain("deal.**");
  });

  it("falls back to placeholders when values are empty", () => {
    const out = buildStandardTerms(template, defaultForm());
    expect(out).toContain("laws of the State of **[__________]**");
  });

  it("leaves non-span template text untouched", () => {
    const out = buildStandardTerms(template, filled());
    expect(out).toContain("Equitable Relief");
    expect(out).toContain("1. **Introduction**");
    expect(out).toContain("free to use under [CC BY 4.0]");
  });

  it("handles a template with no spans", () => {
    expect(buildStandardTerms("plain", filled())).toBe("plain");
  });

  it("does not treat `$&`-style replacement patterns in user text specially", () => {
    const out = buildStandardTerms(template, filled({ governingLaw: "$& $1 $$" }));
    expect(out).toContain("State of **$& $1 $$**");
  });

  it("does not leak regex/HTML from user input into the output", () => {
    const out = buildStandardTerms(template, filled({ jurisdiction: "<b>x</b>" }));
    expect(out).not.toContain("<b>");
  });
});

describe("buildDocument", () => {
  it("joins cover page and standard terms with a rule", () => {
    const doc = buildDocument(template, filled());
    expect(doc.indexOf("# Mutual Non-Disclosure Agreement")).toBe(0);
    expect(doc.indexOf("\n---\n")).toBeGreaterThan(0);
    expect(doc.indexOf("# Standard Terms")).toBeGreaterThan(doc.indexOf("\n---\n"));
    expect(doc.endsWith("\n")).toBe(true);
  });
  it("is deterministic", () => {
    expect(buildDocument(template, filled())).toBe(buildDocument(template, filled()));
  });
  it("produces no unresolved placeholders when fully filled", () => {
    const full = filled({
      party1: { name: "A", title: "T", company: "C", notice: "N" },
      party2: { name: "B", title: "T", company: "C", notice: "N" },
    });
    expect(buildDocument(template, full)).not.toContain("[__________]");
  });
});

describe("missingFields", () => {
  it("lists every blank required detail and ignores optional modifications", () => {
    expect(missingFields(defaultForm())).toEqual([
      "Governing law", "Jurisdiction",
      "Party 1 company", "Party 1 signatory name", "Party 1 title", "Party 1 notice address",
      "Party 2 company", "Party 2 signatory name", "Party 2 title", "Party 2 notice address",
    ]);
  });

  it("is empty once everything required is filled, even whitespace-only counts as blank", () => {
    const form = defaultForm();
    form.governingLaw = "Delaware";
    form.jurisdiction = "  ";
    for (const p of [form.party1, form.party2]) Object.assign(p, { company: "A", name: "B", title: "C", notice: "D" });
    expect(missingFields(form)).toEqual(["Jurisdiction"]);
    form.jurisdiction = "New Castle, DE";
    expect(missingFields(form)).toEqual([]);
  });
});
