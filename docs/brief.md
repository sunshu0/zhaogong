# Product brief

Requirements with acceptance criteria and status: `docs/prd.md` (the original PRD artifact could not be exported; `prd.md` is compiled from this brief, the project description and the user's decisions).

## Positioning

海外的中文工作平台：发帖一分钟，雇主经过验证，职位合规。First market: Auckland, service jobs (hospitality first). Call it 「中文招聘」, never 「华人招聘」.

## Job seekers (line A)

1. Arrive from a WeChat or Xiaohongshu link; browse without signing in.
2. Filter by region, industry, pay (hourly), full-time / part-time / casual, visa accepted, meals / accommodation included; keyword search in Chinese or English.
3. Job detail: Chinese and English side by side, employer verification badge, posted date, pay against the minimum wage.
4. Contact the employer in one of two ways, chosen by the employer per job (Round 10):
   - **Public:** signed-in job seekers see the phone / WeChat / email on the job page; each view is recorded and the employer sees the count.
   - **Private (default):** contact details are only exchanged in chat. **Whoever starts an exchange offers their own details first**; the other side sees them with the request and, on accepting, gives theirs back; rejecting gives nothing. There is no address exchange — only contact details and resume / company details.
   Either way, 立即沟通 starts a chat.
5. Report a job (reasons in `REPORT_REASON_LABELS`).
6. Every job page shares well in WeChat (title, pay, region in the page metadata).

## Employers (line B)

1. **AI job-post generator** — paste a WeChat message or type freely → structured bilingual job. Works before sign-in; publishing needs sign-in. In this stage the "AI" is a deterministic parser stub in `src/lib/ai-post/` with the same interface a real model call will have.
2. **Compliance check before publishing** (`src/lib/compliance/`, real logic, unit-tested): pay below the country's minimum wage blocks publishing; words implying fees (押金, 介绍费, 买工作), visa selling (包签, 卖工签, 办工签), or ethnic preference (限华人, 只要华人, 中国人优先) block or ask for a rewrite; high-risk categories (按摩, 陪酒, KTV) go to manual review.
3. Choose per job whether contact details are public (at least one of phone / WeChat / email) or private, exchanged in chat (the default) — see job seekers 4. Editing a job can change the choice.
4. Copy as text for Skykiwi / Xiaohongshu / WeChat, with the job link and no contact details.
5. Manage jobs: edit, close, refresh; jobs expire after 30 days.
6. Business verification: enter company name or NZBN → demo lookup → 已验证企业 badge.
7. **Moderation queue (admin)**: new jobs flagged by rules and reported jobs; actions take down / dismiss / ban, each logged. Off unless `ADMIN_ENABLED=1` (B24).

## Scope

找工 is a complete product, not only a front end (user, 2026-10-15). The front end is done with demo data; the backend — database behind `src/lib/data.ts`, real email-code sign-in with server sessions, chats / exchanges / notifications / reports stored on the server — is Round 12 phase 3 (see the work queue). Which email provider and AI model to use, and deploying with a remote database, wait for the user.

Not in scope now: payments and paid extras, scheduling tools, any market other than NZ, a native app.
