# 架构

> 描述 2026-10-20 的代码（点击统计 #312–#321、关于 / 隐私 / 条款 #323–#324、Logo #328、查看记录 #336 之后）。决定记录在 `docs/adr/`，页面和组件的阅读入口在 `docs/frontend-code-map.md`，Server Function 的完整列表在 `docs/api.md`。

## 一句话

Next.js 16（App Router，React 19，Cache Components）单仓库应用。页面在服务器渲染；职位、企业、账号等服务器数据都经过 `src/lib/data.ts`，存在 libSQL 数据库（Drizzle，ADR 0005）；写操作走 Server Functions（`"use server"` 的 `actions.ts`），身份取自服务器会话（ADR 0007）。聊天、交换、通知已读、求职者主页（ADR 0017）和企业主页（ADR 0022）都在数据库里，浏览器 `localStorage` 只做缓存和还没送到的改动；只在浏览器的还有浏览和举报记录、企业主页的私密交换资料。部署目标是 Cloudflare Workers（OpenNext）。

## 目录

| 位置 | 内容 | 规则 |
| --- | --- | --- |
| `src/app/` | 路由。页面都在 `src/app/[lang]/` 下，每种语言各预渲染一份，`src/proxy.ts` 按 cookie `zg_lang` 改写到其中一份（ADR 0023）；不分语言的 `api/`、`robots.ts`、`sitemap.ts` 留在根下。`page.tsx` 是服务器组件，只取数据、拼页面 | 每个可写的区域旁边有一个 `actions.ts` |
| `src/components/seeker/` | 求职端页面组件，以及两种身份共用的聊天、通知、主页 | 历史原因放在 seeker 下，阶段二按功能整理 |
| `src/components/employer/` | 雇主发帖、职位管理、推荐人才、企业验证 | |
| `src/components/account/` | 「我的」、待办、资料完成度、候选人条件这类跨身份的逻辑 | 纯函数都有单测 |
| `src/components/ui/` | 共用组件和导航：`Button`、`Tag`、`Pay`、`Section`、`MoreMenu`、`VerificationBadge`、`BottomNav`、顶栏的标志 `BrandMark`（#328）、读取失败 `LoadFailed`（ADR 0024）、页面加载时记一条事件的 `TrackView`（#314） | 视觉规则见 `docs/design-system.md`，设计稿在 `docs/design/`（Logo 的设计源在 `docs/design/logo-a/`） |
| `src/components/analytics/`、`src/components/legal/`、`src/components/external/` | Clarity 的加载和同意提示（ADR 0025）；隐私说明和使用条款共用的页面骨架 `LegalPage`；外部职位的「去官网申请」 | |
| `src/lib/` | 领域逻辑：合规检查 `compliance/`、AI 发帖 `ai-post/`、交换规则 `chat-consent.ts`、候选人匹配、数据访问 `data.ts`、类型 `types.ts`；登录和会话 `auth/`；服务器上的聊天存储 `chat-server/`；外部职位 `external-jobs/`（见「外部职位」）；点击统计的事件 `events/` 和 Clarity 的规则 `analytics/`（ADR 0025）；审核员查看个人信息的类别 `personal-info-views.ts`（ADR 0026） | 不依赖 React；`auth/`、`chat-server/` 只在服务器用 |
| `src/db/` | 数据库：表结构 `schema.ts`、连接和第一次使用时的迁移与演示数据 `ready.ts`、同一进程内排队 `one-at-a-time.ts`、登录用的 `auth-store.ts`、聊天用的 `chat-store.ts` | 迁移文件在 `drizzle/` |
| `src/config/` | 国家配置（地区、最低工资） | |
| `src/i18n/` | 中英切换（ADR 0023）：语言和 cookie、字典机制、日期和金额格式、两种语言的名称表 `labels.ts`。字典的中文在 `messages/<模块>.ts`，英文在 `messages/en/<模块>.ts`，浏览器只在英文页面加载英文（#240） | 阅读入口见 `docs/frontend-code-map.md` 的「中英切换」 |
| `src/mock/` | 演示数据 | 只由 `data.ts` 读取 |
| `e2e/` | Playwright 浏览器测试（手机 375 和桌面 1280 两个项目） | |

## 数据放在哪里

两层：服务器上的数据库是准的，浏览器只做缓存和还没上服务器的部分。

**数据库（`src/db/`）：** `src/lib/data.ts` 读写职位 `jobs`、企业 `employers`、账号 `accounts`（含和企业的绑定）、举报 `reports`、审核日志 `moderation_log`、联系方式查看记录 `contact_views`（#8、#11）；`src/lib/auth` 的验证码和会话（`sign_in_codes`、`sessions`，#9，ADR 0007）和验证码的次数上限（`auth_limits`，ADR 0033）；`src/lib/chat-server` 的每个身份的聊天记录、通知已读和已应用的改动编号（#10，`chat_records` 表，#42）；`src/db/job-stats.ts` 的职位浏览和发起聊天计数（`job_views`、`job_chat_starts`，#55）；`src/db/job-alerts.ts` 的职位提醒和提醒命中（`job_alerts`、`job_alert_hits`，#53）；`src/db/account-data.ts` 导出和删除一个账号的全部数据（#54，ADR 0009）。职位举报附的截图（ADR 0027）不进数据库：线上放在 R2 桶 `EVIDENCE_BUCKET`，本机放在 `data/uploads/report-evidence`（`src/db/evidence-store.ts`），只经 `/api/report-evidence/[id]` 交给审核员。本机是 libSQL 文件 `data/zhaogong.db`，重启服务器不会丢，测试每个文件一个内存库；第一次用到时迁移，空库且 `DEMO_DATA` 打开时导入 `src/mock` 的演示数据（ADR 0005）。函数签名沿用阶段一（ADR 0001），页面不知道背后是数据库；聊天放在 `ChatServerStore` 接口后面，单测换成内存实现。线上数据库用 Cloudflare D1（#15，ADR 0029），集成分支已完成事务改写及本机 D1 验证（ADR 0031），最终构建和浏览器验收仍待完成，尚未建远程库。

后来加的表（都在 `src/db/schema.ts`，读写在 `src/db/` 下对应的模块里，如 `team.ts`、`job-applications.ts`、`external-jobs.ts`）：

| 表 | 内容 | 决定 |
| --- | --- | --- |
| `accounts` 的 `lang` | 账号选的界面语言，空就是没选过 | ADR 0023 |
| `conversations`、`messages`、`exchanges` | 求职者和企业共用的一条对话，企业整个团队一起读写 | ADR 0015 |
| `team_invites`、`team_chats` | 企业的团队和邀请；雇主一侧的聊天按企业存一份 | ADR 0012 |
| `team_invite_links` | 团队邀请链接：只存令牌的哈希，7 天、一次、可撤销，只能加入为成员（`src/db/team-links.ts`） | ADR 0028 |
| `write_guards` | D1 原子批量写入的临时守卫，只在 batch 中存在，完成或失败后不留记录（`src/db/guarded-batch.ts`）；团队快照与重试见 `team-state.ts` 和 `optimistic.ts` | ADR 0031 |
| `moderators` | 审核员名单（`npm run admin:grant` 加第一位） | ADR 0007 补充 |
| `verification_requests` | 企业验证的申请和审核员的核对、驳回理由 | ADR 0011 |
| `saved_jobs` | 收藏和进度，只有账号自己读 | |
| `job_renewals` | 雇主每次延长截止日期的记录 | |
| `job_applications` | 候选人：这个职位聊过的人（`source` 是 `chat`，没有主页和附言）和以前的申请（`apply`，带申请时的主页快照）；合适 / 不合适 / 录用存在这一行上 | ADR 0019、0030 |
| `interviews` | 约面试：雇主给的时间、求职者的回复 | |
| `resume_shares` | 中英文简历的分享链接，每个账号最多一个 | |
| `seeker_profiles` | 求职者主页，存在账号上 | ADR 0017 |
| `employer_profiles` | 企业主页公开的部分，属于企业 | ADR 0022 |
| `ai_usage` | AI 发帖每次调用的用量，用来限额和算审核数据 | ADR 0018 |
| `external_jobs`、`external_company_blocks` | 外部职位（只存事实）和公司的停用、删除请求，见下面「外部职位」 | ADR 0014 |
| `saved_external_jobs`、`external_job_alert_hits` | 外部职位的收藏和提醒命中 | ADR 0020 |
| `report_evidence` | 职位举报附的证据：选中的聊天消息（举报时的快照）和截图，只给审核员看，处理完 180 天后删 | ADR 0027 |
| `events` | 点击统计的匿名事件（访客是按天变的 HMAC，不存 IP 和 UA），留 180 天；审核数据的漏斗从这里算（`src/db/events.ts`） | ADR 0025 |
| `personal_info_views` | 审核员看过谁的个人信息：审核员、时间、类别、记录编号，不记内容，留一年（`src/db/personal-info-views.ts`） | ADR 0026 |

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
- **开通雇主身份：** 正式环境只能新建企业（未验证）。认领现成的演示店只在打开演示数据时可以（`demoDataWanted()`，#348）：没有演示数据时 `e1` 这类编号是真实的企业，团队的人都删号以后也不能被别人认领，只能由审核员处理或由它的团队邀请。加入别人的企业只能由它的管理员邀请（ADR 0012）。
- **切换身份：** `switchIdentity` 在服务器上改会话的当前身份，只有账号有企业时才能切到雇主。
- `/admin` 只有设置 `ADMIN_ENABLED=1` 时开放（B24），打开时还要求登录并且是审核员（`requireModerator()`，#50，ADR 0007 补充）。第一位审核员用 `npm run admin:grant <邮箱>` 添加，之后在 /admin 的「审核员」一页里增删。

## Server Functions

| 文件 | 管什么 |
| --- | --- |
| `src/app/[lang]/account/actions.ts` | 数据与账号 |
| `src/app/[lang]/admin/actions.ts` | 审核后台 |
| `src/app/[lang]/admin/evidence-actions.ts` | 举报附的聊天和截图，仅审核员可读，交出聊天前记录查看记录（ADR 0027） |
| `src/app/[lang]/admin/entry-actions.ts` | 审核后台的入口：账号能不能打开 /admin（#73） |
| `src/app/[lang]/admin/external-actions.ts` | 审核后台「外部职位」 |
| `src/app/[lang]/admin/stats-actions.ts` | 审核数据（#70，ADR 0010） |
| `src/app/[lang]/admin/verification-actions.ts` | 企业验证的审核（#78，ADR 0011） |
| `src/app/[lang]/admin/views-actions.ts` | 审核后台的查看记录（#336，ADR 0026） |
| `src/app/[lang]/employer/actions.ts` | 雇主 |
| `src/app/[lang]/employer/applicant-actions.ts` | 候选人：聊过这个职位的人和以前的申请（ADR 0030） |
| `src/app/[lang]/employer/count-view.ts` | 职位浏览计数 |
| `src/app/[lang]/employer/interview-actions.ts` | 约面试 |
| `src/app/[lang]/employer/page-actions.ts` | 企业主页 |
| `src/app/[lang]/employer/team-actions.ts` | 团队 |
| `src/app/[lang]/jobs/[id]/actions.ts` | 职位（求职者） |
| `src/app/[lang]/jobs/[id]/apply-actions.ts` | 申请职位：求职者这边只剩读（#352，用户 10-20 定删掉「申请」） |
| `src/app/[lang]/jobs/pay-reference-actions.ts` | 时薪参考 |
| `src/app/[lang]/login/actions.ts` | 登录与身份 |
| `src/app/[lang]/me/alerts/actions.ts` | 职位提醒 |
| `src/app/[lang]/me/interview-actions.ts` | 约面试 |
| `src/app/[lang]/me/saved/actions.ts` | 收藏和进度 |
| `src/app/[lang]/messages/actions.ts` | 聊天、交换和通知 |
| `src/app/[lang]/profile/actions.ts` | 我的主页 |
| `src/app/[lang]/profile/candidate-actions.ts` | 推荐人才：雇主看到的求职者主页 |
| `src/app/[lang]/profile/resume/actions.ts` | 中英文简历的分享链接 |
| `src/i18n/actions.ts` | 界面语言 |

每个文件导出哪些函数、参数、返回和错误，都在 `docs/api.md` 里写到这个文件的那一节（#306：这里只列文件，加函数时只改 api.md）。另有一个只在开发环境存在的路由 `POST /api/dev/chat-reply`，让演示对话的对方已读或回复，浏览器测试用。

## 发布职位的路径

1. 雇主粘贴或对话输入 → `parseDraft` / `chatTurn`（`src/lib/ai-post/`，确定性规则，接口按以后接模型设计）。
2. 表单校验 → `checkJob`（`src/lib/compliance/`）：低于最低工资、收费、卖签证、按种族或国籍招人直接拦截；高风险行业进人工审核。
3. `publishJob` 在服务器上再查一次身份和合规，写进 `data.ts`；需要审核的职位状态是 `pending_review`，在 `/admin` 处理。

## 外部职位

实习和专业职位两个分区（`/internships`、`/professional`，#113）里的职位不是雇主在找工发的，而是从公司招聘系统的公开接口导入的（ADR 0014）。代码在 `src/lib/external-jobs/`。

1. **名单和条款：** 公司名单在 `src/config/external-companies.ts`，每家写明条款审核的结论。导入前先查条款（ADR 0014），读取一律经过 `polite-fetch.ts`。
2. **导入：** `npm run import:external`（`src/db/cli.ts`）读接口，找出事实（`facts.ts`：城市、领域、类型、截止日期、签证的陈述、需要审核员留意的标记等），只留新西兰的软件和电子电气职位，只把事实写进 `external_jobs`，原文不存。新导入的都是待审。分区页上的筛选在 `filter.ts`。
3. **审核：** 审核后台的「外部职位」一页通过或不显示，带标记的要先核对原文（`review.ts`）。
4. **显示：** 读取时判断能不能显示（`visibility.ts`）：审核通过、没有下架、最近 2 天内刷新到过、截止日没过。详情页 `/external/[id]` 不收录（`noindex`），只有「去官网申请」。
5. **演示库（#244）：** `next dev` 新建演示库时，会在后台导入名单上的真实职位（`demo-import.ts`，一共最多 30 秒，失败只记日志），演示审核员自动通过没有标记的。离线时保留 `demo-` 开头的假职位。测试构建、单测和生产环境都不导入，`EXTERNAL_JOBS=demo|real` 可以手动指定（`src/db/ready.ts`）。

收藏和提醒见 ADR 0020。线上的定时导入还没配。

## 联系方式

每个职位由雇主选择是否公开联系方式（ADR 0002）。公开的职位，登录的求职者在详情页查看，查看记录在服务器；不公开的，双方在聊天里交换，发起方先提供自己的资料。

## 渲染和部署

- Cache Components 开启：静态部分预渲染，依赖请求的部分（会话、`usePathname` 的动态路由）放在 `Suspense` 里流式输出。底部导航和顶栏导航有静态的占位，不开 JavaScript 也能用。
- Cloudflare Workers + OpenNext（ADR 0004），数据库是 Cloudflare D1（ADR 0029，ADR 0031 已在集成分支实现）。还没重新部署：用户 10-20 定了等邮件服务（#16）定下来一起上线，部署前要过 #332；步骤见 `docs/cloudflare-deployment.md`。

## 测试

- `npm run check`：Prettier、`tsc`、ESLint、Vitest（逻辑都写单测，`*.test.ts` 和代码放一起）、生产构建。
- 浏览器测试（Playwright，手机和桌面两个项目，含 axe 无障碍检查）跑在**测试构建**上，不用 `next dev`（#139）：`npm run e2e:build` 用 `ZG_E2E=1` 做一次生产构建（放在 `.next-e2e`，用 `tsconfig.e2e.json`），`npm run e2e:start -- <端口>` 启动，再 `E2E_SERVER=start E2E_PORT=<端口> npx playwright test --workers=1`。`ZG_E2E` 在构建时写死（`next.config.ts`），只有这个构建保留测试要用的开发功能（登录页显示验证码、`/api/dev/*`、脚本发帖助手、`zg_ai_fake`），部署构建里设了它会直接报错（`src/lib/test-build.ts` 和它的单测）。全套 e2e 在 next dev 上会涨到 3–5 GB，在测试构建上峰值约 1.3 GB。测试用 `signIn()` 真实登录（读开发环境返回的验证码），用 `/api/dev/chat-reply` 模拟对方回复。
