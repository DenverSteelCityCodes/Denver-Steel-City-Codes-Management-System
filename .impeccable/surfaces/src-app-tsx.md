---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["design/impeccable-audit/mockup"]
---

# Surface: the whole SCC Denver app (all roles)

Mode: **Operate** on every signed-in surface; the demo login and the signed-out `/apply` opening carry Persuade weight but stay Operate.

Audience and jobs: see PRODUCT.md (parents on phones registering campers at a fixed opening minute; teen and adult volunteers taking roll call standing in a room; the Regional Director and helpers running the season on a laptop).

Constraints: no modals; top tabs for parents and volunteers; 16px inputs; 44px targets; settings under the avatar; no long scrolling pages; no new features; wordmark on ink; brand gold never as text on white; Josefin Sans for brand moments (page titles) only, a legibility-first UI face for everything else.

Critique evidence: `design/impeccable-audit/raw/` (A-public, A-parent, A-volunteer, A-admin, B-detector-audit).

## Direction contract

THESIS: Every screen is a junction sign. The one next decision for this person stands in a single gold band at the top, with the number they act on (room, time, count, seats) at monumental scale and an arrow locked to the edge it points past; everything after the band is the list of other decisions, one per line. It refuses the category default of a dashboard of equal white cards, stat tiles and icon eyebrows.

OWN-WORLD: Terminal yellow (brand gold #F1C446) is reserved for wayfinding: the sign band, the active tab marker and the one primary action, nothing else. Ink (#1A1613) carries the shell, the type and white-on-ink pictogram squares that name a decision's kind. The floor is a quiet neutral concourse (#F4F4F1, no cream), with content set straight on it; containers exist only as signs and as tables. State colours sit on top only where they mean something: red for safety, destruction and blocking validation errors (a form that can't continue), green for done. A legibility-first humanist sans (Atkinson Hyperlegible Next) in sentence case, tabular numerals; Josefin Sans only for page titles. Heavy 2px ink rules separate decisions; 1px rules separate rows of one dataset. One ply, no shadows.

STORY: A parent sees immediately whether each child is set and what to do next; a volunteer sees roll call and who has an allergy without tapping; the director sees whether registration is open, or who is unaccounted, before anything else. Each believes the system is fair and current because the numbers are honest and live; each acts with one tap on the band or the line.

FIRST VIEWPORT: Ink bar (56px) with the wordmark left and the avatar right; ink tab strip under it (parents and volunteers) with a 3px gold marker on the active tab; admin keeps a 5-item side rail plus Setup. Then the sign band, full width: one line of context (14px), the monumental figure (56–64px tabular) beside a 48px ink arrow square, the message (20–22px bold), and one supporting line. Below it, the decision list: pictogram square, decision as a sentence, one action. The primary action is the sign's arrow or the single gold button on the floor, never both.

FORM: Terminal yellow wayfinding (challenger, chosen by the director over the assigned Camp Shirt world). seed:dbdcf9ea9ceebb61 (the roll's printed output, key redacted, is archived at design/impeccable-audit/raw/concept-seed-direction.txt). Kept from the declined hand: one ply only; fixed furniture in a fixed order on every person row; block height equals duration in schedules; stable identifiers (section codes, week numbers) set like gate numbers for staff; hierarchy from type scale, not boxes. Signature interaction: when a status changes (roll-call count, seats left, offer clock) the band's figure updates with a split-flap swap (150ms, steps), instant under reduced motion.

FINISH: unreviewed and undocumented is unfinished; the finish reviewer and documenter run before this ships.
