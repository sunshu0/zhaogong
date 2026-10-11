# Product brief (frontend stage)

Full PRD (Chinese): https://claude.ai/code/artifact/7abb5167-bc53-4345-ac66-c73c8f27da58

## Positioning

海外的中文工作平台：发帖一分钟，雇主经过验证，职位合规。First market: Auckland, service jobs (hospitality first). Call it 「中文招聘」, never 「华人招聘」.

## Job seekers (line A)

1. Arrive from a WeChat or Xiaohongshu link; browse without signing in.
2. Filter by region, industry, pay (hourly), full-time / part-time / casual, visa accepted, meals / accommodation included; keyword search in Chinese or English.
3. Job detail: Chinese and English side by side, employer verification badge, posted date, pay against the minimum wage.
4. Sign in (demo: email code) to see contact details; record who viewed them.
5. Report a job (reasons in `REPORT_REASON_LABELS`).
6. Every job page shares well in WeChat (title, pay, region in the page metadata).

## Employers (line B)

1. **AI job-post generator** — paste a WeChat message or type freely → structured bilingual job. Works before sign-in; publishing needs sign-in. In this stage the "AI" is a deterministic parser stub in `src/lib/ai-post/` with the same interface a real model call will have.
2. **Compliance check before publishing** (`src/lib/compliance/`, real logic, unit-tested): pay below the country's minimum wage blocks publishing; words implying fees (押金, 介绍费, 买工作), visa selling (包签, 卖工签, 办工签), or ethnic preference (限华人, 只要华人, 中国人优先) block or ask for a rewrite; high-risk categories (按摩, 陪酒, KTV) go to manual review.
3. Copy as text for Skykiwi / Xiaohongshu / WeChat, with the job link.
4. Manage jobs: edit, close, refresh; jobs expire after 30 days.
5. Business verification: enter company name or NZBN → demo lookup → 已验证企业 badge.
6. **Moderation queue (admin)**: new jobs flagged by rules and reported jobs; actions take down / dismiss / ban, each logged.

## Out of scope now

In-app chat, payments, real authentication, real AI calls, any backend, any market other than NZ.
