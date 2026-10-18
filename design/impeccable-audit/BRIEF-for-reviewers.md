# Brief for the impeccable critique sub-agents

You are one isolated assessment in an `/impeccable critique` + `/impeccable audit` run over the whole Steel City Codes Denver site. Follow impeccable's own playbooks; they are the method, not suggestions.

## Paths

- Worktree (latest `main`, read-only for you except your output file): `/Users/haaniemohammed/Denver-SCC-worktrees/impeccable-audit`
- Product context (read first): `PRODUCT.md` in the worktree root. Also `design_system.md` (the incumbent design system) and `docs/scc-improvement-plan.md` §1 (flow maps for every role, lines 69–360).
- Impeccable skill source: `/private/tmp/claude-501/-Users-haaniemohammed-Steel-City-Codes-Management-System/7dabb1fb-ef6a-444f-8c80-d5e75865d451/scratchpad/src-impeccable/impeccable/skill/` — read `SKILL.src.md`, `reference/critique.md` (heuristics scoring guide, cognitive load checklist, personas, severity), `reference/craft-floor.md`, `reference/mode-operate.md`, `reference/operate.md`, plus `reference/layout.md`, `typeset.md`, `colorize.md`, `distill.md`, `clarify.md` for the lens on each element.
- Screenshots of every route on the live demo, captured 2026-10-17: `design/impeccable-audit/before/<role>-<route>.<m|d>.png` (`m` = 390×844 phone, `d` = 1440×900 desktop, both full-page) and `<role>-<route>.txt` (page text). View them with the Read tool.
- Live demo: https://scc.haanie.com — `/login` has one-click demo buttons ("Camp admin", "Parent", "Volunteer", "Volunteer applicant"). Fictional data, reset nightly.
- Headless browser if you need states the screenshots don't show (wizard steps, menus, expanded rows, dark mode): Playwright is installed at `.../scratchpad/pw` (`import { chromium } from 'playwright'` from a script inside that folder; launch with `executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'`). See `.../scratchpad/pw/capture.mjs` for the login pattern. Dark mode: `localStorage.setItem('scc-theme','dark')` before load. **Read-only: never submit a form, take roll call, claim a duty, save, delete, or click anything that writes.** Opening menus, expanding rows, switching tabs and wizard "Next" that only validates are fine. Save any extra screenshots under `design/impeccable-audit/before/extra/`.

## The director's ask (the bar for this review)

"Justify every div. Every decoration should be purposeful, and the UI should be optimized and impeccable. You can change a lot." So beyond impeccable's normal critique, do an **element-justification inventory**: for each screen, walk every visible element and decoration (cards, borders, shadows, icons, icon tiles, pills/badges, colors, dividers, headings, helper text, empty space, repeated labels) and give it a one-line verdict: **Keep** (its job), **Cut** (no job), **Merge** (duplicates another element's job), or **Change** (has a job but does it badly). Be concrete: name the element as a user would see it, and cite the source file:line when you can.

Constraints the redesign must respect (from PRODUCT.md): no modals; mobile-browser-first for parents and volunteers (top tabs, 16px inputs, 44px targets, safe areas, 375px light + dark); settings under the avatar menu; no long scrolling pages; no new features (re-layout, re-word, merge, remove and restyle freely, but don't invent capabilities); keep the wordmark and brand gold, gold never as text on white.

## Mode

Every authenticated page is **Operate**. The login page's demo panel and the signed-out apply page have a **Persuade** flavour (first impression for a portfolio reviewer and a teen deciding to volunteer) but are still primarily Operate. Say if you disagree.
