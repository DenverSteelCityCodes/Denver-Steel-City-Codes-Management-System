# impeccable audit and Terminal Yellow redesign (2026-10-17)

An [impeccable](https://impeccable.style) critique and technical audit of every screen on the live demo, then a redesign of every screen in the direction the director chose. Open `report.html` in a browser for the readable version; it links to the clickable mockup.

| Path | What it is |
|---|---|
| `REPORT.md`, `report.html` | The combined critique + audit: scores (24/40 design health, 13/20 technical), the P0 and P1s, persona red flags, the element inventory summary, before/after |
| `raw/A-public.md`, `A-parent.md`, `A-volunteer.md`, `A-admin.md` | Each isolated design reviewer's full output: Nielsen scores, cognitive load, personas, an element-by-element Keep/Cut/Merge/Change inventory with file:line, and the redesign spec per screen |
| `raw/B-detector-audit.md`, `raw/detector-*.json` | impeccable detector results (source + URL scans), axe, measured contrast, and the 5-dimension technical audit |
| `raw/concept-seed-direction.txt` | The direction roll that produced the Terminal Yellow world (key redacted) |
| `mockup/` | 54 redesigned screens (`screens/`), the shared system (`system.css`, `css/<role>.css`, `mock.js`), and per-screen justification notes (`notes/`). Open `mockup/index.html` |
| `before/*.txt` | Page text of every live route at capture time (fictional demo data) |
| `shots/` | Cropped before/after screenshots used by the report |
| `BRIEF-for-reviewers.md`, `mockup/BUILD-BRIEF.md` | The briefs the review and build agents worked from |
| `tools/` | Playwright scripts that regenerate the evidence |

The system itself is recorded in `/DESIGN.md` (the target design system; `design_system.md` at the root describes the look the app ships today). Product context for impeccable is `/PRODUCT.md`; the direction contract is `.impeccable/surfaces/src-app-tsx.md`.

**Not committed (size):** the full-page screenshots of every route (`before/*.png`, `before/extra/`), the rendered DOM dumps and dark-mode axe captures from the audit. Regenerate them with the tools (Playwright installed; set `CHROMIUM_PATH` if you use a local Chromium):

```bash
node design/impeccable-audit/tools/capture.mjs design/impeccable-audit/before
node design/impeccable-audit/tools/shot.mjs /tmp/shots design/impeccable-audit/mockup/screens/parent-home.html
```

All data shown is the demo's fictional data.
