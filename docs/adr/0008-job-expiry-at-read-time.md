# 0008 过期职位：读取时判断，不跑定时任务

- 状态：已采纳
- 日期：2026-10-16（#57，R-32）

## 情况

每个职位有截止时间 `expiresAt`（发布或刷新后 30 天）。第 14 轮要求职位到了截止时间自动按下架处理：职位列表、首页和 `sitemap.xml` 不再出现，详情页显示「已截止」。在这之前：

- 雇主端（`effectiveStatus`）、职位详情（`isExpired`）、企业主页、聊天入口都已经按 `expiresAt` 判断；
- 但 `listJobs`、`listFeaturedJobs` 只看 `status = "active"`，过了截止时间的职位还会出现在职位列表、首页的橱窗告示和「N 个职位在招」里。

两种做法：

1. **定时任务：** 每天把过了截止时间的职位的 `status` 改成 `expired`。要在 Cloudflare Workers 上配 Cron Trigger（OpenNext 需要另写一个 `scheduled` 入口），本机开发和测试还要另外模拟；任务两次运行之间，过期的职位仍会被列出。
2. **读取时判断：** 「在招」= `status` 是 `active` 并且 `expiresAt` 晚于现在。每次读取都按当时的时间算，数据库里的 `status` 不变。

## 决定

读取时判断。共用一个纯函数 `isOpenJob(job, now)`（`src/lib/job-expiry.ts`）：

- `listJobs`（`src/lib/data.ts`）只返回在招的职位；`listFeaturedJobs` 由调用方传入当前时间 `now`，首页的橱窗告示和精选职位按请求时间传。首页给关闭 JavaScript 的浏览器准备的那一小块（`NoScriptLanding`）是构建时预渲染的快照，Cache Components 不允许在那里读时钟，所以不按时间过滤，和它本来就是快照一致；
- `sitemap.xml`（`src/lib/site.ts`）只列在招的职位和有在招职位的企业；
- 职位详情页对过期职位照常可以打开，显示「这个职位已截止」，不再输出 `JobPosting` 结构化数据；
- 数据库里的 `status` 只在雇主结束招聘、审核下架时改变（`expired`、`removed`）。雇主端用 `effectiveStatus` 把过期的 `active` 显示成「已截止」，可以「刷新」重新上线。

## 后果

- 到截止时间那一刻就不再列出，不依赖任务按时运行，本机、测试和线上的行为一致，不用新的基础设施。
- 职位多了以后，「状态是 active 但已过期」的行仍会被 SQL 选出来再在代码里过滤掉。到那时可以把条件放进 SQL（`expires_at > now`，`expires_at` 已经是统一格式的 ISO 时间），或者再加定时任务把它们改成 `expired`；两者不冲突。
- 判断「在招」只有 `isOpenJob` 一处（雇主端的 `effectiveStatus` 规则相同）。以后改规则（例如宽限一天）只改这里。
