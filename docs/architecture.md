# 架构

> 描述 2026-10-16 的代码：数据库（#8、#11）、登录和服务器会话（#9）、聊天存服务器（#10）已合并。决定记录在 `docs/adr/`，页面和组件的阅读入口在 `docs/frontend-code-map.md`。

## 一句话

Next.js 16（App Router，React 19，Cache Components）单仓库应用。页面在服务器渲染；职位、企业、账号等服务器数据都经过 `src/lib/data.ts`，存在 libSQL 数据库（Drizzle，ADR 0005）；写操作走 Server Functions（`"use server"` 的 `actions.ts`），身份取自服务器会话（ADR 0007）。聊天、交换和通知已读按身份存在数据库里，浏览器 `localStorage` 只做缓存；主页资料、浏览和举报记录目前仍只在浏览器。部署目标是 Cloudflare Workers（OpenNext）。

## 目录

| 位置 | 内容 | 规则 |
| --- | --- | --- |
| `src/app/` | 路由。页面都在 `src/app/[lang]/` 下，每种语言各预渲染一份，`src/proxy.ts` 按 cookie `zg_lang` 改写到其中一份（ADR 0023）；不分语言的 `api/`、`robots.ts`、`sitemap.ts` 留在根下。`page.tsx` 是服务器组件，只取数据、拼页面 | 每个可写的区域旁边有一个 `actions.ts` |
| `src/components/seeker/` | 求职端页面组件，以及两种身份共用的聊天、通知、主页 | 历史原因放在 seeker 下，阶段二按功能整理 |
| `src/components/employer/` | 雇主发帖、职位管理、推荐人才、企业验证 | |
| `src/components/account/` | 「我的」、待办、资料完成度、候选人条件这类跨身份的逻辑 | 纯函数都有单测 |
| `src/components/ui/` | 共用组件和导航：`Button`、`Tag`、`Pay`、`Section`、`MoreMenu`、`VerificationBadge`、`BottomNav` | 视觉规则见 `docs/design-system.md`，设计稿在 `docs/design/` |
| `src/lib/` | 领域逻辑：合规检查 `compliance/`、AI 发帖 `ai-post/`、交换规则 `chat-consent.ts`、候选人匹配、数据访问 `data.ts`、类型 `types.ts`；登录和会话 `auth/`；服务器上的聊天存储 `chat-server/` | 不依赖 React；`auth/`、`chat-server/` 只在服务器用 |
| `src/db/` | 数据库：表结构 `schema.ts`、连接和第一次使用时的迁移与演示数据 `ready.ts`、同一进程内排队 `one-at-a-time.ts`、登录用的 `auth-store.ts`、聊天用的 `chat-store.ts` | 迁移文件在 `drizzle/` |
| `src/config/` | 国家配置（地区、最低工资） | |
| `src/i18n/` | 中英切换（ADR 0023）：语言和 cookie、字典机制、日期和金额格式、两种语言的名称表 `labels.ts`。字典的中文在 `messages/<模块>.ts`，英文在 `messages/en/<模块>.ts`，浏览器只在英文页面加载英文（#240） | 阅读入口见 `docs/frontend-code-map.md` 的「中英切换」 |
| `src/mock/` | 演示数据 | 只由 `data.ts` 读取 |
| `e2e/` | Playwright 浏览器测试（手机 375 和桌面 1280 两个项目） | |

## 数据放在哪里

两层：服务器上的数据库是准的，浏览器只做缓存和还没上服务器的部分。

**数据库（`src/db/`）：** `src/lib/data.ts` 读写职位、企业、账号与企业绑定、举报、审核日志、联系方式查看记录（#8、#11）；`src/lib/auth` 的验证码和会话（`sign_in_codes`、`sessions`，#9，ADR 0007）；`src/lib/chat-server` 的每个身份的聊天记录、通知已读和已应用的改动编号（#10，`chat_records` 表，#42）；`src/db/job-stats.ts` 的职位浏览和发起聊天计数（`job_views`、`job_chat_starts`，#55）；`src/db/job-alerts.ts` 的职位提醒和提醒命中（`job_alerts`、`job_alert_hits`，#53）；`src/db/account-data.ts` 导出和删除一个账号的全部数据（#54，ADR 0009）。本机是 libSQL 文件 `data/zhaogong.db`，重启服务器不会丢，测试每个文件一个内存库；第一次用到时迁移，空库且 `DEMO_DATA` 打开时导入 `src/mock` 的演示数据（ADR 0005）。函数签名沿用阶段一（ADR 0001），页面不知道背后是数据库；聊天放在 `ChatServerStore` 接口后面，单测换成内存实现。线上用哪种数据库待用户决定（#15，ADR 0006）。

**浏览器（`createLocalStore`，`src/components/seeker/local-store.ts`）：**

| 键 | 内容 |
| --- | --- |
| `zhaogong:session` | 会话的副本，只用来显示；每次加载页面用 `accountStatus()` 跟服务器对一次，改它不能登录任何人 |
| `zhaogong:chat-demo` | 聊天记录的缓存（每个身份一份，只存用户自己产生的部分，演示对话读取时合并），跟着服务器的回答更新 |
| `zhaogong:chat-outbox` | 待发送队列：页面已经显示、服务器还没确认的聊天改动。每项带编号，离开页面后下次加载再发，服务器按编号只应用一次（`chat-outbox.ts`） |
| `zhaogong:notifications-by-identity` | 通知已读的缓存，跟着服务器更新 |
| `zhaogong:profiles-by-identity` | 每个身份的主页资料改动。求职者的是账号上 `seeker_profiles` 的副本（#104）；企业主页公开的几项是企业的 `employer_profiles` 的副本，私密交换资料只在浏览器（ADR 0022） |
| `zhaogong:profile-sync` | 每个求职者身份：本机副本上次和账号对上的保存时间，有没有还没送到的改动（`profile-sync.ts`） |
| `zhaogong:viewed-jobs`、`zhaogong:reports-sent` | 浏览和举报记录（只在浏览器） |

这些数据带版本号，读取时迁移老格式（A23）。身份之间互不可见：键里按「邮箱 + 身份 + 企业」分区（`identity-scope.ts`），服务器上的聊天也用同一个键。

## 身份和权限

一个账号可以同时是求职者和一家企业的雇主，页面按当前身份显示（ADR 0003）。一家企业可以有一个团队：几个账号，分管理员和成员（#87，ADR 0012）；雇主一侧的聊天记录按企业存一份（`team_chats`），每条消息记下回复人。

- **登录：** 邮箱验证码，注册和登录是同一步；成功后服务器发一个 httpOnly 的会话 cookie，库里存它的哈希、账号和当前身份，30 天过期（ADR 0007，`src/lib/auth/`）。生产环境要等接上邮件服务（#16）才能发验证码。
- **读身份：** Server Functions 用 `getCurrentSession()` / `requireSession()` / `requireEmployer()` 从 cookie 读账号和当前身份，不收邮箱参数（雇主和审核接口在 #19 改完）；企业每次用 `getAccountEmployer` 从账号查，不信任浏览器传来的企业编号。
- **切换身份：** `switchIdentity` 在服务器上改会话的当前身份，只有账号有企业时才能切到雇主。
- `/admin` 只有设置 `ADMIN_ENABLED=1` 时开放（B24），打开时还要求登录并且是审核员（`requireModerator()`，#50，ADR 0007 补充）。第一位审核员用 `npm run admin:grant <邮箱>` 添加，之后在 /admin 的「审核员」一页里增删。

## Server Functions

| 文件 | 函数 |
| --- | --- |
| `src/app/[lang]/login/actions.ts` | `requestSignInCode`、`signInAccount`、`accountStatus`、`switchIdentity`、`openEmployerForAccount`、`signOutAccount` |
| `src/app/[lang]/jobs/[id]/actions.ts` | `revealContact`、`reportJob`、`jobSummary` |
| `src/app/[lang]/messages/actions.ts` | `myChat`、`changeMyChat`、`importMyChat`、`myNotificationReads`、`markMyNotificationsRead` |
| `src/app/[lang]/employer/actions.ts` | `getMyJobs`、`getMyJob`、`getContactViewCounts`、`parseDraft`、`chatTurn`、`publishJob`、`editMyJob`、`closeMyJob`、`confirmHires`、`refreshMyJob`、`getMyEmployer`、`lookupBusiness`、`verifyBusiness` |
| `src/app/[lang]/admin/actions.ts` | `getModerationQueue`、`approveJob`、`takeDownJob`、`dismissReports`、`banJobEmployer`、`getModerators`、`addModerator`、`removeModerator` |

请求、响应和错误的详细说明在 `docs/api.md`。另有一个只在开发环境存在的路由 `POST /api/dev/chat-reply`，让演示对话的对方已读或回复，浏览器测试用。

## 发布职位的路径

1. 雇主粘贴或对话输入 → `parseDraft` / `chatTurn`（`src/lib/ai-post/`，确定性规则，接口按以后接模型设计）。
2. 表单校验 → `checkJob`（`src/lib/compliance/`）：低于最低工资、收费、卖签证、按种族或国籍招人直接拦截；高风险行业进人工审核。
3. `publishJob` 在服务器上再查一次身份和合规，写进 `data.ts`；需要审核的职位状态是 `pending_review`，在 `/admin` 处理。

## 联系方式

每个职位由雇主选择是否公开联系方式（ADR 0002）。公开的职位，登录的求职者在详情页查看，查看记录在服务器；不公开的，双方在聊天里交换，发起方先提供自己的资料。

## 渲染和部署

- Cache Components 开启：静态部分预渲染，依赖请求的部分（会话、`usePathname` 的动态路由）放在 `Suspense` 里流式输出。底部导航和顶栏导航有静态的占位，不开 JavaScript 也能用。
- Cloudflare Workers + OpenNext（ADR 0004）。数据都在数据库里，但线上数据库还没选（#15），选定之前不重新部署。

## 测试

- `npm run check`：Prettier、`tsc`、ESLint、Vitest（逻辑都写单测，`*.test.ts` 和代码放一起）、生产构建。
- 浏览器测试（Playwright，手机和桌面两个项目，含 axe 无障碍检查）跑在**测试构建**上，不用 `next dev`（#139）：`npm run e2e:build` 用 `ZG_E2E=1` 做一次生产构建（放在 `.next-e2e`，用 `tsconfig.e2e.json`），`npm run e2e:start -- <端口>` 启动，再 `E2E_SERVER=start E2E_PORT=<端口> npx playwright test --workers=1`。`ZG_E2E` 在构建时写死（`next.config.ts`），只有这个构建保留测试要用的开发功能（登录页显示验证码、`/api/dev/*`、脚本发帖助手、`zg_ai_fake`），部署构建里设了它会直接报错（`src/lib/test-build.ts` 和它的单测）。全套 e2e 在 next dev 上会涨到 3–5 GB，在测试构建上峰值约 1.3 GB。测试用 `signIn()` 真实登录（读开发环境返回的验证码），用 `/api/dev/chat-reply` 模拟对方回复。
