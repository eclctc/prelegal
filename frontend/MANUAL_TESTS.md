# Manual test plan – Mutual NDA creator

Run `cd frontend && npm run dev` and open http://localhost:3000. Automated coverage is in
`tests/unit` (Vitest) and `tests/e2e` (Playwright); these checks cover what automation can't judge well
(look and feel, real print dialogs, real OS file handling). Record pass/fail and browser/OS for each run.

| # | Area | Steps | Expected |
|---|------|-------|----------|
| 1 | First load | Open the page. | Form on the left, agreement preview on the right, today's date filled in, no console errors. |
| 2 | Live preview | Type in every field. | Preview updates on each keystroke with no lag or cursor jumps. |
| 3 | Placeholders | Leave governing law, jurisdiction and party fields blank. | `[__________]` appears in the cover page and in Section 9; nothing says `undefined`/`NaN`. |
| 4 | MNDA term | Select each option; set years to 1, 2, 10, 99. | Cover page checkbox ticks the matching option; Section 5 reads "expires N year(s) after the Effective Date" or "continues until terminated…". |
| 5 | Confidentiality | Same for "N years" and "In perpetuity". | Section 5 reads "will survive for N years … trade secrets…" or "will survive in perpetuity". |
| 6 | Years input | Clear the box, type `7`; type `0`, `abc`, `1.5`, `999`; tab away. | Can clear and retype; only 1–99 digits accepted; invalid entry reverts on blur. |
| 7 | Governing law | Enter `Delaware`, then `State of Delaware`. | Both read "laws of the State of Delaware" (never "State of State of"). |
| 8 | Multi-line | Enter two lines in Modifications and Purpose. | Modifications show as separate paragraphs; Purpose reads as one sentence in Section 1–2. |
| 9 | Hostile input | Purpose `# Title <b>x</b> *y*`; company `A \| B`; modifications `---`. | Shown literally as text; no heading, bold, table break or rule. |
| 10 | Signature table | Fill both parties. | Values in the right columns; Signature and Date rows stay empty for signing. |
| 11 | Download | Click **Download (.md)**; open the file in an editor. | File `Mutual-NDA.md`; cover page + `---` + Standard Terms; values filled; CC BY 4.0 notice present. |
| 12 | Print / PDF | Click **Print / Save as PDF**, choose "Save as PDF". | Form and buttons absent; full agreement across pages (not one screen); 1" margins; table not cut off; works in landscape. |
| 13 | Timezone | Set OS timezone to Pacific/Auckland near midnight (or Honolulu in the evening). | Default date is the local calendar day. |
| 14 | Keyboard | Tab through the form; use arrow keys in each radio group; press Enter on both buttons. | Logical tab order, visible focus ring, arrows switch radios, buttons activate. |
| 15 | Screen reader | VoiceOver on the form. | Each control announces its label; hints are read as descriptions; number inputs announce "term in years". |
| 16 | Responsive | Resize from 1440px down to 320px; try a phone. | No horizontal scroll; table wraps; form usable on touch. |
| 17 | Dark mode | Switch the OS to dark mode and reload. | All form text remains readable (UI is light-only). |
| 18 | Browsers | Repeat 2, 11, 12 in Chrome, Safari and Firefox. | Same results. |
| 19 | Attribution | Read the footer and the end of each document part. | Common Paper credited with CC BY 4.0 links. |
| 20 | Template change | Edit a sentence in `../templates/Mutual-NDA.md`, restart. | App shows the edit (templates are the single source). |
