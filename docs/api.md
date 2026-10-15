# 接口说明

> 描述 2026-10-15 `main` 上的接口。阶段三（#8 数据库、#9 登录和会话、#10 聊天存服务器、#11 举报和审核入库）合并后补充新增的接口，并更新「身份」一节。

找工没有单独的 REST 服务。浏览器通过 **Server Functions**（`"use server"` 的 `actions.ts`）读写服务器数据：页面里的客户端组件直接调用这些异步函数，Next.js 把调用变成对当前页面地址的 POST 请求（带 `Next-Action` 头）。这个请求格式是 Next.js 的内部约定，不是给外部调用的公开 API；对外稳定的是下面列出的**函数签名、返回值和错误文字**。

所有服务器数据最终经过 `src/lib/data.ts`（ADR 0001）。

## 约定

- **身份（演示阶段）：** 需要知道是谁的函数都收 `email` 参数，服务器按邮箱找到账号和绑定的企业（`getAccountEmployer`），从不使用浏览器传来的企业编号。服务器目前**信任**收到的邮箱；#9 接入服务器会话后，这些参数会去掉，改为读会话。
- **结果形状：** 写操作返回带 `ok` 的联合类型，失败时 `error`（登录、举报）或 `error_zh`（雇主、审核）是可以直接显示给用户的中文句子。读操作在没有权限或找不到时返回 `null`、空数组或空对象，不抛错。
- **输入：** 所有参数都在服务器上重新校验（类型、长度、枚举值），浏览器的校验只是提示。
- **国家：** 目前固定新西兰（`DEFAULT_COUNTRY = "NZ"`）。

## 登录与身份 — `src/app/login/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `signInAccount(email, code)` | 邮箱；6 位数字验证码（演示：任意 6 位） | `{ ok: true, account: AccountStatus }`，首次使用时创建账号 | `{ ok: false, error }`：「请输入正确的邮箱地址」「请输入 6 位数字验证码」 |
| `accountStatus(email)` | 邮箱 | `AccountStatus`：`{ email, employer?: { id, name } }`，浏览器用它校正本机的会话 | 邮箱无效时 `null` |
| `openEmployerForAccount(email, choice)` | `choice`：`{ kind: "existing", employerId: "e1" \| "e2" \| "e4" }` 或 `{ kind: "new", name, regionId }` | `{ ok: true, employer: { id, name } }`；已有企业的账号直接返回原企业 | `{ ok: false, error }`：「请先登录」「请选择一家店」「请填写店名」「店名最多 40 个字」「请选择地区」、已被其他账号绑定、企业已停用、找不到企业 |

## 职位（求职者）— `src/app/jobs/[id]/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `revealContact(jobId, email)` | 职位编号；登录用户的邮箱 | `{ phone?, wechat?, email? }`。只对雇主选择公开联系方式（`contactPublic`）、且求职者能看到的职位；同一人对同一职位 30 分钟内只记一次查看 | `null`（参数无效、职位不公开联系方式、已下架或不存在） |
| `reportJob(jobId, reason, note?)` | `reason`：`fake_job`、`charges_fee`、`below_min_wage`、`discriminatory`、`visa_selling`、`inappropriate`、`other`；`note` 最多 500 字，选 `other` 时必填。不需要登录 | `{ ok: true, reportId }` | `{ ok: false, error }`：「请选择举报原因」「补充说明最多 500 字」「选择“其他”时，请简单写一下原因」「找不到这个职位，可能已经下架」 |
| `jobSummary(jobId)` | 职位编号 | `{ id, title, pay, open }`，聊天顶部的职位条用；`open` 表示还在招 | `null` |

## 雇主 — `src/app/employer/actions.ts`

除 `parseDraft`、`lookupBusiness` 外都需要雇主身份：账号必须绑定了一家没被停用的企业。没有时读操作返回空结果，写操作返回「需要先开通雇主身份。」或「账号已被停用，不能再修改职位。」。只能操作自己企业的职位，别人的职位一律当作「找不到这个职位。」。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getMyJobs(email)` | | 本企业所有职位，按发布时间从新到旧，任何状态 | `[]` |
| `getMyJob(jobId, email)` | | 本企业的这个职位 | `null` |
| `getContactViewCounts(email)` | | `{ [jobId]: 查看联系方式的人数 }`，只有人数，不给是谁 | `{}` |
| `parseDraft(text)` | 招聘文字，最多取前 5000 字 | `ParsedPost`：`{ draft, missing, notes_zh }`（规则解析，以后换成模型调用，签名不变） | — |
| `chatTurn(state, message, email?)` | 浏览器保存的对话状态（服务器先重建和清洗）；本轮输入 | 下一轮的 `ChatState`（问题、快捷选项、草稿） | — |
| `publishJob(input, email)` | 职位草稿，服务器重新清洗和检查 | `{ ok: true, job }`，状态是 `active`，命中需人工审核的规则时是 `pending_review` | `{ ok: false, reason, findings, missing }`：`no_identity`、`banned`、`not_ready`（有拦截或必须改写的问题，或必填项没填） |
| `editMyJob(jobId, email, input)` | 修改后的草稿 | `{ ok: true, job }`；在线的职位改出需审核的内容会回到审核 | `{ ok: false, error_zh, findings? }`：「这个职位已被下架，不能修改。」「还有问题没处理或必填项没填。」 |
| `closeMyJob(jobId, email, hires?)` | `hires`：`{ hired: true, count: 1–20 }` 或 `{ hired: false }`，可省略 | `{ ok: true, job }`，状态 `expired` | 「这个职位已经结束或已被下架。」「人数请填 1 到 20。」 |
| `confirmHires(jobId, email, hires)` | 同上，用于事后更正 | `{ ok: true, job }` | 「职位结束后才能记录招到几人。」「请选择招到了，或者没有 / 不确定。」 |
| `refreshMyJob(jobId, email)` | | `{ ok: true, job }`，再开 30 天；已结束的职位重新检查后上线或进审核 | 「不能刷新：…」（24 小时内只能刷新一次等）、「这个职位不符合现在的发布规则，请先编辑。」 |
| `getMyEmployer(email)` | | 账号绑定的企业（含验证状态、是否被停用） | `null` |
| `lookupBusiness(query)` | 公司名或 NZBN，最多 100 字 | `{ results: RegisterEntry[], error_zh? }`（演示登记表，以后换成 NZBN 接口） | — |
| `verifyBusiness(email, nzbn)` | NZBN | `{ ok: true, employer }`，显示「已验证企业」，认证雇主保持原级别 | `{ ok: false, error_zh }`：「企业登记里没有这个 NZBN。」「这家公司在企业登记里已注销，不能用来验证。」「这个 NZBN 已经被其他店铺验证。…」「账号已被停用，不能验证。」 |

`findings` 的每一项：`{ level: "block" | "rewrite" | "review", field, message_zh, rule, matches }`（`src/lib/compliance/`）。

## 审核后台 — `src/app/admin/actions.ts`

只有环境变量 `ADMIN_ENABLED=1` 时可用（本机开发由 `.env.development` 打开，线上不设）；否则每个函数都抛出「审核后台未开放。」。演示阶段没有审核员登录，#11 之后改为检查审核员会话。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getModerationQueue()` | | `{ flagged, reported, log }`：待审核的职位、有未处理举报的职位（只含职位举报）、操作日志 | — |
| `approveJob(jobId)` | | `{ ok: true, text }`，职位上线 30 天，记日志 | `{ ok: false, error_zh }`：「这个职位不在待审核列表里。」「雇主已被封禁，不能通过。」「这个职位仍有不能发布的问题，只能下架。」 |
| `takeDownJob(jobId)` | | 下架，未处理的举报标为已处理，记日志 | 「找不到这个职位。」 |
| `dismissReports(jobId)` | | 驳回这个职位的举报，职位不变，记日志 | 「找不到这个职位。」「这个职位没有待处理的举报。」 |
| `banJobEmployer(jobId)` | | 封禁职位的雇主，下架其所有职位并关闭相关举报，记日志 | 「找不到这个雇主。」「这个雇主已经被封禁。」 |

## 页面路由

| 路由 | 内容 | 需要 |
| --- | --- | --- |
| `/` | 介绍页 | — |
| `/jobs`、`/jobs/[id]` | 职位列表（筛选条件在查询参数里）、职位详情 | — |
| `/employers/[id]` | 企业公开主页 | — |
| `/login` | 注册或登录（`?role=employer` 开通雇主身份，`?next=` 回到原页面） | — |
| `/account`、`/workspace`、`/messages`、`/notifications`、`/profile`、`/me` | 我的、待办、聊天、通知、主页编辑、浏览与举报 | 登录 |
| `/candidates/[id]` | 求职者主页（`?job=` 带上职位） | 雇主身份才显示职位和聊天入口 |
| `/employer` | 雇主介绍 | — |
| `/employer/post`、`/employer/jobs`、`/employer/jobs/[id]`、`/employer/candidates`、`/employer/verify` | 发布、职位管理、编辑职位、推荐人才、企业验证 | 雇主身份 |
| `/admin` | 审核后台 | `ADMIN_ENABLED=1` |
| `/manifest.webmanifest` | 可安装网页的清单 | — |
