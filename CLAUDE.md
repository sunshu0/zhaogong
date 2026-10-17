# 找工 (working name) — start here

A Chinese-language job board for overseas Chinese communities, starting in Auckland with hospitality and other service jobs. Product brief: `docs/brief.md`. This stage is **frontend only**: every page reads demo data through `src/lib/data.ts`; there is no backend yet.

Read `AGENTS.md` too: this is Next.js 16 and differs from older versions. Check `node_modules/next/dist/docs/` before using an API you are unsure of.

## Who owns what

| Area | Owner | Paths |
| --- | --- | --- |
| Shared foundation | Lead (总导师) | `src/lib/types.ts`, `src/lib/data.ts`, `src/config/**`, `src/mock/**`, `src/i18n/**`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json` |
| Line A — job seekers | 找工 · 执行 A | `src/app/page.tsx`, `src/app/jobs/**`, `src/app/login/**`, `src/app/me/**`, `src/components/seeker/**` |
| Line B — employers and moderation | 找工 · 执行 B | `src/app/employer/**`, `src/app/admin/**`, `src/components/employer/**`, `src/lib/compliance/**`, `src/lib/ai-post/**` |
| Shared UI pieces | Whoever needs one first; announce it in the queue | `src/components/ui/**` |

To change a file you do not own, write a one-line request in the queue (`D:/dev/zhaogong-work-queue.md`) and wait for the lead. Adding a field to a shared type, a new data function, or a new npm package all count as changes to shared files.

## Rules

- Chinese is the main language of the UI; English appears alongside where the brief says (job titles, descriptions).
- Mobile first: design for a 375 px wide phone, then check desktop.
- Never show anything that reads as visa or immigration advice. Visa fields state facts only.
- Never add a field that asks for race, ethnicity or nationality. Language requirements are allowed.
- Contact details (phone, WeChat, email) are shown only to signed-in users, and only in one of two ways the employer chooses per job (`Job.contactPublic`): public on the job page (each view recorded), or exchanged in chat, where whoever starts the exchange offers their own details first. No address exchange. See ADR 0002.
- Tests first for logic (Vitest, `*.test.ts` next to the code). One commit per item, message says what changed.
- Before every push: `npm run check` must pass (typecheck, lint, unit tests, build). Push only after it exits 0.
- In Git Bash, prefix Next commands with `NEXT_TELEMETRY_DISABLED=1` (the telemetry config write fails on this machine with EXDEV).

## Ports and clones

| Who | Clone | Dev server |
| --- | --- | --- |
| Lead (verify only) | `D:/dev/zhaogong` | 8701 |
| Line A | `D:/dev/zhaogong-a` | 8702 (`npx next dev -p 8702`) |
| Line B | `D:/dev/zhaogong-b` | 8703 (`npx next dev -p 8703`) |

Ports 8059–8586 are reserved by Windows on this machine; do not use them. Only one `next dev` can run per clone.

**Browser tests run on the test build, never on `next dev` (#139):** `next dev` grew to 3–5 GB in a full run; the test build peaks near 1.3 GB. `npm run e2e:build` (a production build with `ZG_E2E=1`, in `.next-e2e`; again after every code change), then `npm run e2e:start -- <port>`, then `E2E_SERVER=start E2E_PORT=<port> npx playwright test --workers=1`, then stop the server and the browsers at once. One full run at a time on this machine (the lock directory `D:/dev/zhaogong-e2e.lock.d`); start the build only with 4.5 GB or more free and the tests with 4 GB or more, and stop when free memory falls below 1.5 GB (总导师, 2026-10-17). `npm run db:reset` before a full run, with the server stopped. Browser tests publish demo jobs into the database; reset it before showing a demo. `origin` is the local bare repository `D:/dev/zhaogong.git`. Rebase onto `origin/main` before pushing; never force-push.

The lead clone also has a `github` remote for the private repository `https://github.com/open-alternative-app/zhaogong`. GitHub publishing uses `git push github main`; do not publish parked branches or stashes. The local `origin` remains available for coordinating the A/B clones. Cloudflare deployment is separate from Git pushes; no automatic deployment is configured.
