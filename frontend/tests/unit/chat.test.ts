import { describe, expect, it } from "vitest";
import { mergeFields } from "@/lib/chat";
import { defaultForm } from "@/lib/nda";

describe("mergeFields", () => {
  it("applies provided values and leaves nulls untouched", () => {
    const form = { ...defaultForm(), governingLaw: "Texas" };
    const next = mergeFields(form, { governingLaw: null, jurisdiction: "Austin, TX", termKind: "continues" });
    expect(next.governingLaw).toBe("Texas");
    expect(next.jurisdiction).toBe("Austin, TX");
    expect(next.termKind).toBe("continues");
  });

  it("merges party fields without clearing the others", () => {
    const form = defaultForm();
    form.party1.name = "Ann";
    const next = mergeFields(form, { party1: { company: "Acme Inc", name: null }, party2: { company: "Globex" } });
    expect(next.party1).toEqual({ name: "Ann", title: "", company: "Acme Inc", notice: "" });
    expect(next.party2.company).toBe("Globex");
  });

  it("ignores blank strings so filled fields are not wiped", () => {
    const form = { ...defaultForm(), governingLaw: "Texas" };
    form.party1.company = "Acme Inc";
    const next = mergeFields(form, { governingLaw: "", party1: { company: "  " } });
    expect(next.governingLaw).toBe("Texas");
    expect(next.party1.company).toBe("Acme Inc");
  });

  it("applies year counts", () => {
    expect(mergeFields(defaultForm(), { termYears: 3 }).termYears).toBe(3);
  });
});
