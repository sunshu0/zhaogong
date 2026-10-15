# 接口说明

> 描述 2026-10-16 `main` 上的接口：数据库（#8、#11）、登录和服务器会话（#9）、聊天存服务器（#10、#42）、雇主和审核接口读会话（#19）、收藏和进度（#52）都已合并。

找工没有单独的 REST 服务。浏览器通过 **Server Functions**（`"use server"` 的 `actions.ts`）读写服务器数据：页面里的客户端组件直接调用这些异步函数，Next.js 把调用变成对当前页面地址的 POST 请求（带 `Next-Action` 头）。这个请求格式是 Next.js 的内部约定，不是给外部调用的公开 API；对外稳定的是下面列出的**函数签名、返回值和错误文字**。

所有服务器数据最终经过 `src/lib/data.ts`（ADR 0001）。

## 约定

- **身份：** 登录后服务器发一个 httpOnly 会话 cookie（`zg_session`，ADR 0007）。职位、聊天、雇主和审核的函数都从会话读出账号和当前身份，不收邮箱（登录一节只在登录和开通雇主身份时带邮箱）；企业每次用 `getAccountEmployer` 从账号查，从不使用浏览器传来的企业编号。
- **未登录：** 需要登录的读操作返回 `null`，聊天的写操作也返回 `null`（不改任何东西）；登录一节的函数返回「请先登录」。
- **结果形状：** 写操作返回带 `ok` 的联合类型，失败时 `error`（登录、举报）或 `error_zh`（雇主、审核）是可以直接显示给用户的中文句子。读操作在没有权限或找不到时返回 `null`、空数组或空对象，不抛错。
- **输入：** 所有参数都在服务器上重新校验（类型、长度、枚举值），浏览器的校验只是提示。
- **国家：** 目前固定新西兰（`DEFAULT_COUNTRY = "NZ"`）。

## 登录与身份 — `src/app/login/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
`AccountStatus`（即 `SessionView`）：`{ email, activeRole: "seeker" | "employer", employer?: { id, name } }`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `requestSignInCode(email)` | 邮箱 | `{ ok: true }`，验证码 10 分钟有效。开发和测试环境另带 `devCode`（登录页直接显示），生产环境永远不带 | `{ ok: false, error }`：「请输入正确的邮箱地址」「验证码刚发过，请 N 秒后再获取」（每个邮箱每分钟一次）「邮件服务还没有配置，暂时无法发送验证码」（生产环境，#16） |
| `signInAccount(email, code, role?)` | 邮箱；6 位数字验证码；想要的身份，默认 `seeker`，账号有企业时才能是 `employer` | `{ ok: true, account: AccountStatus }`，首次使用时创建账号，并设置会话 cookie（30 天） | `{ ok: false, error }`：「请输入正确的邮箱地址」「请输入 6 位数字验证码」「请先获取验证码」「验证码已过期，请重新获取」「验证码不对，还可以再试 N 次」「错误次数太多，请重新获取验证码」（错 5 次作废） |
| `accountStatus(email?)` | 可选：浏览器副本里的邮箱 | 当前会话的 `AccountStatus`；浏览器每次加载页面用它校正本机副本 | 没有会话、或会话属于另一个邮箱时 `null` |
| `switchIdentity(role)` | `"seeker"` 或 `"employer"` | 切换后的 `AccountStatus`；账号没有企业时留在求职者身份 | 没有会话时 `null` |
| `openEmployerForAccount(email, choice)` | 邮箱须和会话一致；`choice`：`{ kind: "existing", employerId: "e1" \| "e2" \| "e4" }` 或 `{ kind: "new", name, regionId }` | `{ ok: true, employer: { id, name } }`，并把会话切到雇主身份；已有企业的账号直接返回原企业 | `{ ok: false, error }`：「请先登录」「请选择一家店」「请填写店名」「店名最多 40 个字」「请选择地区」、已被其他账号绑定、企业已停用、找不到企业 |
| `signOutAccount()` | | 删除服务器上的会话和 cookie | — |

## 数据与账号 — `src/app/account/actions.ts`

账号一律取自会话（#54，ADR 0009）。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myServerData()` | | `{ ok: true, data: ServerAccountData }`：账号、审核员身份、企业和它的全部职位、各身份的聊天记录和已读通知、收藏的职位和求职进度、看过联系方式的职位、登录会话（只有身份和时间）。浏览器再加上本机的资料、举报和浏览记录，下载成 `zhaogong-my-data-日期.json` | `{ ok: false, error }`：「请先登录」「找不到这个账号」 |
| `deleteMyAccount(email)` | 再输入一次登录邮箱（不分大小写、首尾空格） | `{ ok: true }`：删除账号、所有会话、验证码、聊天记录、收藏和审核员身份；企业的职位下架并清空联系方式；查看记录和「由谁添加」改成 `deleted-account`；删除这次的 cookie | `{ ok: false, error }`：「请先登录」「输入的邮箱和当前登录的邮箱不一致」「你是最后一位审核员。请先在审核后台添加另一位审核员，再删除账号。」 |

## 职位（求职者）— `src/app/jobs/[id]/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `revealContact(jobId)` | 职位编号；查看的人取自会话 | `{ phone?, wechat?, email? }`。只对雇主选择公开联系方式（`contactPublic`）、且求职者能看到的职位；同一人对同一职位 30 分钟内只记一次查看 | `null`（未登录、参数无效、职位不公开联系方式、已下架或不存在） |
| `reportJob(jobId, reason, note?)` | `reason`：`fake_job`、`charges_fee`、`below_min_wage`、`discriminatory`、`visa_selling`、`inappropriate`、`other`；`note` 最多 500 字，选 `other` 时必填。不需要登录 | `{ ok: true, reportId }` | `{ ok: false, error }`：「请选择举报原因」「补充说明最多 500 字」「选择“其他”时，请简单写一下原因」「找不到这个职位，可能已经下架」 |
| `jobSummary(jobId)` | 职位编号 | `{ id, title, pay, open }`，聊天顶部的职位条用；`open` 表示还在招 | `null` |

## 雇主 — `src/app/employer/actions.ts`

账号从会话 cookie 读取（#19），函数不收邮箱参数。除 `parseDraft`、`lookupBusiness` 外都需要雇主身份：已登录，且账号绑定了一家没被停用的企业。没有时读操作返回空结果；写操作返回「请先登录。」（`publishJob` 是 `reason: "signed_out"`）、「需要先开通雇主身份。」或「账号已被停用，不能再修改职位。」。只能操作自己企业的职位，别人的职位一律当作「找不到这个职位。」。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getMyJobs()` | | 本企业所有职位，按发布时间从新到旧，任何状态 | `[]` |
| `getMyJob(jobId)` | | 本企业的这个职位 | `null` |
| `getContactViewCounts()` | | `{ [jobId]: 查看联系方式的人数 }`，只有人数，不给是谁 | `{}` |
| `parseDraft(text)` | 招聘文字，最多取前 5000 字 | `ParsedPost`：`{ draft, missing, notes_zh }`（规则解析，以后换成模型调用，签名不变） | — |
| `chatTurn(state, message)` | 浏览器保存的对话状态（服务器先重建和清洗）；本轮输入 | 下一轮的 `ChatState`（问题、快捷选项、草稿） | — |
| `publishJob(input)` | 职位草稿，服务器重新清洗和检查 | `{ ok: true, job }`，状态是 `active`，命中需人工审核的规则时是 `pending_review` | `{ ok: false, reason, findings, missing }`：`signed_out`、`no_identity`、`banned`、`not_ready`（有拦截或必须改写的问题，或必填项没填） |
| `editMyJob(jobId, input)` | 修改后的草稿 | `{ ok: true, job }`；在线的职位改出需审核的内容会回到审核 | `{ ok: false, error_zh, findings? }`：「这个职位已被下架，不能修改。」「还有问题没处理或必填项没填。」 |
| `closeMyJob(jobId, hires?)` | `hires`：`{ hired: true, count: 1–20 }` 或 `{ hired: false }`，可省略 | `{ ok: true, job }`，状态 `expired` | 「这个职位已经结束或已被下架。」「人数请填 1 到 20。」 |
| `confirmHires(jobId, hires)` | 同上，用于事后更正 | `{ ok: true, job }` | 「职位结束后才能记录招到几人。」「请选择招到了，或者没有 / 不确定。」 |
| `refreshMyJob(jobId)` | | `{ ok: true, job }`，再开 30 天；已结束的职位重新检查后上线或进审核 | 「不能刷新：…」（24 小时内只能刷新一次等）、「这个职位不符合现在的发布规则，请先编辑。」 |
| `getMyEmployer()` | | 账号绑定的企业（含验证状态、是否被停用） | `null` |
| `lookupBusiness(query)` | 公司名或 NZBN，最多 100 字 | `{ results: RegisterEntry[], error_zh? }`（演示登记表，以后换成 NZBN 接口） | — |
| `verifyBusiness(nzbn)` | NZBN | `{ ok: true, employer }`，显示「已验证企业」，认证雇主保持原级别 | `{ ok: false, error_zh }`：「企业登记里没有这个 NZBN。」「这家公司在企业登记里已注销，不能用来验证。」「这个 NZBN 已经被其他店铺验证。…」「账号已被停用，不能验证。」 |

`findings` 的每一项：`{ level: "block" | "rewrite" | "review", field, message_zh, rule, matches }`（`src/lib/compliance/`）。

## 聊天、交换和通知 — `src/app/messages/actions.ts`

每个身份（邮箱 + 身份 + 企业，`identityScope`）有自己的一份聊天记录：会话里的消息、已读、交换请求和回应、聊天举报（`ChatRecord`，`src/components/seeker/chat-store.ts`），存在数据库的 `chat_records` 表（#42）。服务器上的这一份是准的；浏览器 `localStorage` 里的是缓存，跟着服务器的回答更新。每次回答都带 `scope`，浏览器只在对应的身份下采用。

`ChatSnapshot`：`{ scope, record: ChatRecord }`。`ReadsSnapshot`：`{ scope, ids: string[] }`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myChat()` | | 当前身份的 `ChatSnapshot`，还没有记录时是空记录 | 未登录时 `null` |
| `changeMyChat(change, ticket?)` | `change` 见下表；`ticket`：`{ id, scope }`，浏览器待发送队列里这一项的编号（8–64 位字母、数字、连字符）和它产生时的身份 | 改动后的 `ChatSnapshot`。带 `ticket` 时同一编号只应用一次（每个身份记最近 200 个），`scope` 和当前会话不一致时不应用（切换身份期间浏览器稍后重发） | 未登录时 `null`；改动不合规则时原样返回当前记录，不报错 |
| `importMyChat(record)` | #10 之前只存在浏览器里的记录 | 服务器还没有这个身份的记录时，校验后存下并返回；已有记录时返回服务器的，不覆盖 | 未登录时 `null`；格式不对时返回空记录 |
| `myNotificationReads()` | | 当前身份已读的通知编号 | 未登录时 `null` |
| `markMyNotificationsRead(ids)` | 通知编号数组，或 `"all"` | 合并后的已读编号；只收这个身份确实有的通知 | 未登录时 `null` |

`changeMyChat` 的 `change`（服务器用和浏览器同一套纯函数检查和应用，时间和编号由服务器生成）：

| `type` | 其余字段 | 规则 |
| --- | --- | --- |
| `open` | `conversation`：`{ kind: "employer", jobId }`（求职者找雇主）或 `{ kind: "candidate", jobId, candidateId, name }`（雇主找候选人） | 职位须在招且没过期；雇主没被封禁，不能和自己的企业聊；找候选人只能用自己企业的职位，演示候选人的名字以服务器为准，名字最多 40 字 |
| `send` | `conversationId`、`text` | 对话须存在；去掉首尾空白后 1–2000 字 |
| `read` | `conversationId` | 把这个对话标为已读 |
| `request` | `conversationId`、`kind`：`contact` 或 `resume`、`payload` | 发起交换，发起方先附上自己的资料（ADR 0002） |
| `answer` | `conversationId`、`exchangeId`、`status`：`accepted`、`rejected`、`cancelled`，同意时带 `payload` | 同意时必须附上自己的资料 |
| `report` | `conversationId`、`reason`、`note`、可选 `messageIndex` | 举报对方的一条消息（只能是对方发的）或整段对话，证据取被举报的那条或最近 100 条 |

## 收藏和进度 — `src/app/me/saved/actions.ts`

#52（PRD R-28）。按账号存在 `saved_jobs` 表（迁移 0004），账号取自会话；只有本人读得到，雇主和别的账号都读不到。

`SavedJobView`：`{ jobId, titleZh, titleEn, pay, country, region?, employerName?, gone, savedAt, stage, picked }`。`gone` 表示职位已下架、过了截止时间或雇主被停用（照样列出，页面标「已下架」）。`stage` 是 `saved`（已收藏）、`contacted`（已联系）、`interviewed`（已面试）、`hired`（已录用）、`rejected`（没成）之一。`picked` 为 `false` 时进度由聊天决定：这个职位的聊天里双方同意交换过联系方式就是 `contacted`，否则 `saved`；用户选过之后以用户选的为准。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `mySavedJobIds()` | | 收藏的职位编号，新的在前（收藏按钮用） | 未登录时 `null` |
| `mySavedJobs()` | | `SavedJobView[]`，新的在前 | 未登录时 `null` |
| `saveMyJob(jobId)` | 职位编号 | 收藏后的编号列表；已收藏过的保留原来的时间和进度 | 未登录时 `null`；职位不存在时不改动 |
| `unsaveMyJob(jobId)` | 职位编号 | 取消后的编号列表，进度一起删除 | 未登录时 `null` |
| `setMyJobStage(jobId, stage)` | 职位编号；上面五个进度之一 | 改后的 `SavedJobView[]` | 未登录时 `null`；不是这五个之一、或职位没收藏时不改动 |

未登录点「收藏」会去 `/login?next=<原页面>?save=<职位编号>`，登录后回到原页面，由页面完成收藏并去掉 `save` 参数。

## 只在开发环境存在的接口

`POST /api/dev/chat-reply`（`src/app/api/dev/chat-reply/route.ts`）：演示对话里的对方不是真实账号，开发和浏览器测试用它让对方「已读」或「回复」。生产环境返回 404。

| 请求体 | 成功 | 失败 |
| --- | --- | --- |
| `{ conversationId, reply?, readMine? }`：`reply` 最多 2000 字；`readMine: true` 把我发的消息标为对方已读 | 200，改动后的 `ChatRecord` | 401 `{ error: "请先登录" }`；400 `{ error: "没有这个对话" }` |

## 审核后台 — `src/app/admin/actions.ts`

只有环境变量 `ADMIN_ENABLED=1` 时可用（本机开发由 `.env.development` 打开，线上不设）；否则每个函数都抛出「审核后台未开放。」。打开时还要求已登录、并且是审核员（`requireModerator()`，`src/app/admin/moderator.ts`，#50）：

- 未登录：`getModerationQueue()`、`getModerators()` 返回 `{ refused: "signed_out", error_zh: "请先登录。" }`，其他函数返回「请先登录。」。
- 已登录但不是审核员：返回 `{ refused: "not_moderator", error_zh: "只有审核员能使用审核后台。" }`，其他函数返回「只有审核员能使用审核后台。」。

第一位审核员用命令行 `npm run admin:grant <邮箱>` 添加（`admin:revoke` 移除），之后审核员在 /admin 的「审核员」一页里增删。开发环境的演示数据带一个演示审核员 `moderator@example.com`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getModerationQueue()` | | `{ flagged, reported, log }`：待审核的职位、有未处理举报的职位（只含职位举报）、操作日志 | `{ refused, error_zh }` |
| `approveJob(jobId)` | | `{ ok: true, text }`，职位上线 30 天，记日志 | `{ ok: false, error_zh }`：「这个职位不在待审核列表里。」「雇主已被封禁，不能通过。」「这个职位仍有不能发布的问题，只能下架。」 |
| `takeDownJob(jobId)` | | 下架，未处理的举报标为已处理，记日志 | 「找不到这个职位。」 |
| `dismissReports(jobId)` | | 驳回这个职位的举报，职位不变，记日志 | 「找不到这个职位。」「这个职位没有待处理的举报。」 |
| `banJobEmployer(jobId)` | | 封禁职位的雇主，下架其所有职位并关闭相关举报，记日志 | 「找不到这个雇主。」「这个雇主已经被封禁。」 |
| `getModerators()` | | `{ me, moderators: [{ email, grantedAt, grantedBy }] }`，从早到晚；`grantedBy` 为 `null` 表示在服务器上添加（命令行或演示数据） | `{ refused, error_zh }` |
| `addModerator(email)` | 已经登录过的账号的邮箱 | `{ ok: true, text }` | 「请输入正确的邮箱地址。」「这个邮箱还没有注册。请对方先用这个邮箱登录一次。」「这个账号已经是审核员。」 |
| `removeModerator(email)` | 审核员的邮箱 | `{ ok: true, text }` | 「至少要留一位审核员，不能移除最后一位。」「这个账号不是审核员。」 |

## 页面路由

| 路由 | 内容 | 需要 |
| --- | --- | --- |
| `/` | 介绍页 | — |
| `/jobs`、`/jobs/[id]` | 职位列表（筛选条件在查询参数里）、职位详情 | — |
| `/employers/[id]` | 企业公开主页 | — |
| `/login` | 注册或登录（`?role=employer` 开通雇主身份，`?next=` 回到原页面） | — |
| `/account`、`/workspace`、`/messages`、`/notifications`、`/profile`、`/me`、`/me/saved` | 我的、待办、聊天、通知、主页编辑、浏览与举报、收藏和进度 | 登录 |
| `/candidates/[id]` | 求职者主页（`?job=` 带上职位） | 雇主身份才显示职位和聊天入口 |
| `/employer` | 雇主介绍 | — |
| `/employer/post`、`/employer/jobs`、`/employer/jobs/[id]`、`/employer/candidates`、`/employer/verify` | 发布、职位管理、编辑职位、推荐人才、企业验证 | 雇主身份 |
| `/admin` | 审核后台 | `ADMIN_ENABLED=1`，审核员 |
| `POST /api/dev/chat-reply` | 演示对话的对方已读或回复（见上） | 只在开发环境；登录 |
| `/manifest.webmanifest` | 可安装网页的清单 | — |
| `/sitemap.xml` | 首页、职位列表、在招职位（过了截止时间的不列，ADR 0008）、有在招职位且没被封禁的企业主页；每次请求时生成 | — |
| `/robots.txt` | 允许收录，但不收录 `/admin`、`/account`、`/workspace`、`/profile`、`/me`、`/messages`、`/notifications`、`/login`、`/employer/`、`/candidates/`、`/api/`；指向 sitemap | — |

职位详情页 `/jobs/[id]` 在职位在招时带一段 schema.org `JobPosting` 结构化数据（`<script type="application/ld+json">`）：职位名、描述、发布和截止时间、雇主和企业主页链接、地点、时薪、用工形式，**不含联系方式**（`src/lib/job-posting.ts`）。sitemap、robots 和结构化数据里的绝对地址用环境变量 `SITE_URL`，没设置时用请求的域名。
