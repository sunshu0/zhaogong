---
name: web-design-guidelines
description: Review 找工's UI code against the Web Interface Guidelines (accessibility, focus, forms, motion, typography, touch, performance). Use when asked to review or audit the UI, check accessibility, or check pages against best practices.
---

# Web Interface Guidelines (找工)

Adapted from Vercel's `web-design-guidelines` skill (vercel-labs/agent-skills, MIT). The rules are a pinned copy in
`guidelines.md` beside this file (vercel-labs/web-interface-guidelines `command.md` at 434b7f9, MIT, see `LICENSE`),
read from disk instead of fetched, so a review does not depend on the network and the rules change only by a commit.

## How to review

1. Read `guidelines.md` in this folder: every rule and the output format are there.
2. Read the files asked for (or ask which pages or components to review).
3. Read `docs/design-system.md` first: 找工's own rules win where they differ (colours, type scale, spacing, the
   375 × 812 three-whole-cards rule A21, the performance budget in `scripts/perf-budget.json`).
4. Check the files against every rule; report findings in the `file:line` format the guidelines give.

## 找工 notes

- The UI is Chinese first: rules about English text (curly quotes, title case, ellipsis characters) apply to the
  English messages in `src/i18n/messages/en/`; for Chinese text check full-width punctuation instead.
- This is a review, not a redesign: list the problems, do not change the look beyond what a finding needs.
- Findings that would change what a user sees go to the mentor before anyone edits them.
