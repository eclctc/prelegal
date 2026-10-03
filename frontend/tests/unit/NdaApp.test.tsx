import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NdaApp from "@/components/NdaApp";

const template = readFileSync(path.join(__dirname, "../../../templates/Mutual-NDA.md"), "utf8");

const setup = () => {
  const user = userEvent.setup();
  render(<NdaApp standardTerms={template} />);
  const preview = () => screen.getByRole("article", { name: "Agreement preview" });
  return { user, preview };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 3, 21, 30)); // evening local time, Oct 3 2026
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("NdaApp", () => {
  it("defaults the effective date to today's local date after mount", () => {
    setup();
    expect(screen.getByLabelText("Effective date")).toHaveValue("2026-10-03");
    expect(screen.getAllByText(/October 3, 2026/).length).toBeGreaterThan(0);
  });

  it("renders the cover page and standard terms with placeholders", () => {
    const { preview } = setup();
    expect(within(preview()).getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(within(preview()).getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
    expect(preview()).toHaveTextContent("Governing Law: [__________]");
    expect(preview()).toHaveTextContent("laws of the State of [__________]");
  });

  it("updates the preview as the user types", async () => {
    const { user, preview } = setup();
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
    await user.type(screen.getByLabelText("Jurisdiction"), "New Castle, DE");
    expect(preview()).toHaveTextContent("Governing Law: Delaware");
    expect(preview()).toHaveTextContent("laws of the State of Delaware, without regard");
    expect(preview()).toHaveTextContent("courts located in New Castle, DE.");
  });

  it("fills in the signature table for both parties", async () => {
    const { user, preview } = setup();
    const [p1, p2] = screen.getAllByRole("group", { name: /Party/ });
    await user.type(within(p1).getByLabelText("Company"), "Acme Inc");
    await user.type(within(p2).getByLabelText("Company"), "Globex LLC");
    await user.type(within(p1).getByLabelText("Signatory name"), "Ann");
    const table = within(preview()).getByRole("table");
    const row = within(table).getByRole("row", { name: /Company/ });
    expect(row).toHaveTextContent("Acme Inc");
    expect(row).toHaveTextContent("Globex LLC");
    expect(within(table).getByRole("row", { name: /Print Name/ })).toHaveTextContent("Ann");
  });

  it("does not render user-entered headings, HTML or table breakouts as markup", async () => {
    const { user, preview } = setup();
    await user.clear(screen.getByLabelText("Purpose"));
    await user.type(screen.getByLabelText("Purpose"), "# Pwned <img src=x>");
    const [p1] = screen.getAllByRole("group", { name: /Party/ });
    await user.type(within(p1).getByLabelText("Company"), "A | B");
    expect(within(preview()).queryByRole("heading", { name: /Pwned/ })).toBeNull();
    expect(preview().querySelector("img")).toBeNull();
    expect(preview()).toHaveTextContent("# Pwned <img src=x>");
    const row = within(within(preview()).getByRole("table")).getByRole("row", { name: /Company/ });
    expect(within(row).getAllByRole("cell")).toHaveLength(3);
    expect(row).toHaveTextContent("A | B");
  });

  it("switches term options and keeps Section 5 grammatical", async () => {
    const { user, preview } = setup();
    await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(preview()).toHaveTextContent("and continues until terminated in accordance with the terms of this MNDA.");
    expect(preview()).toHaveTextContent("will survive in perpetuity");
    const checks = within(preview()).getAllByRole("checkbox");
    expect(checks.filter((c) => (c as HTMLInputElement).checked)).toHaveLength(2);
    expect(checks).toHaveLength(4);
  });

  it("radio groups share a name so arrow keys move within them", () => {
    setup();
    const term = screen.getByRole("group", { name: "MNDA term" });
    const names = within(term).getAllByRole("radio").map((r) => r.getAttribute("name"));
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBeTruthy();
    const conf = screen.getByRole("group", { name: "Term of confidentiality" });
    const confNames = within(conf).getAllByRole("radio").map((r) => r.getAttribute("name"));
    expect(confNames[0]).not.toBe(names[0]);
  });

  describe("years inputs", () => {
    it("lets the user clear and retype a value (no snap-back to 1)", async () => {
      const { user, preview } = setup();
      const box = screen.getByLabelText("MNDA term in years");
      await user.clear(box);
      expect(box).toHaveValue("");
      await user.type(box, "3");
      expect(box).toHaveValue("3");
      expect(preview()).toHaveTextContent("Expires 3 year(s) from Effective Date.");
      expect(preview()).toHaveTextContent("expires 3 years after the Effective Date");
    });
    it("rejects non-digits, zero and absurd values, reverting on blur", async () => {
      const { user, preview } = setup();
      const box = screen.getByLabelText("MNDA term in years");
      await user.clear(box);
      await user.type(box, "1.5e9");
      expect(box).toHaveValue("15"); // digits only, max two characters
      await user.clear(box);
      await user.type(box, "0");
      await user.tab();
      expect(box).toHaveValue("15"); // zero never committed; reverts to last valid value
      expect(preview()).toHaveTextContent("Expires 15 year(s)");
      expect(preview()).not.toHaveTextContent("Infinity");
      expect(preview()).not.toHaveTextContent("NaN");
    });
    it("exposes accessible names for both numeric inputs", () => {
      setup();
      expect(screen.getByLabelText("MNDA term in years")).toBeInTheDocument();
      expect(screen.getByLabelText("Confidentiality term in years")).toBeInTheDocument();
    });
  });

  it("downloads the filled markdown as Mutual-NDA.md", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
    let blob: Blob | undefined;
    const create = vi.fn((b: Blob) => ((blob = b), "blob:test"));
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("Mutual-NDA.md");
      expect(this.href).toBe("blob:test");
    });
    await user.click(screen.getByRole("button", { name: /Download/ }));
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:test");
    expect(blob!.type).toContain("text/markdown");
    const text = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsText(blob!);
    });
    expect(text).toContain("Governing Law: Delaware");
    expect(text).toContain("# Standard Terms");
    click.mockRestore();
  });

  it("opens the print dialog from the Print button", async () => {
    const { user } = setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: /Print/ }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("exposes hints as descriptions, not as part of the field name", () => {
    setup();
    expect(screen.getByRole("textbox", { name: "Governing law" })).toHaveAccessibleDescription("State, e.g. Delaware");
    const [notice] = screen.getAllByRole("textbox", { name: "Notice address" });
    expect(notice).toHaveAccessibleDescription("Email or postal address");
  });

  it("labels every form control", () => {
    setup();
    for (const el of document.querySelectorAll("aside input, aside textarea")) {
      expect(el, el.outerHTML).toHaveAccessibleName();
    }
  });

  it("credits Common Paper under CC BY 4.0", () => {
    setup();
    expect(screen.getByRole("link", { name: /Common Paper Mutual NDA v1.0/ })).toHaveAttribute("href", expect.stringContaining("commonpaper.com"));
    expect(screen.getAllByRole("link", { name: "CC BY 4.0" }).length).toBeGreaterThanOrEqual(2); // footer + document
  });
});
