# 接口说明

> 描述 2026-10-16 `main` 上的接口：数据库（#8、#11）、登录和服务器会话（#9）、聊天存服务器（#10、#42）、雇主和审核接口读会话（#19）、收藏和进度（#52）都已合并。

找工没有单独的 REST 服务。浏览器通过 **Server Functions**（`"use server"` 的 `actions.ts`）读写服务器数据：页面里的客户端组件直接调用这些异步函数，Next.js 把调用变成对当前页面地址的 POST 请求（带 `Next-Action` 头）。这个请求格式是 Next.js 的内部约定，不是给外部调用的公开 API；对外稳定的是下面列出的**函数签名、返回值和错误文字**。

所有服务器数据最终经过 `src/lib/data.ts`（ADR 0001）。

## 约定

- **身份：** 登录后服务器发一个 httpOnly 会话 cookie（生产环境 `__Host-zg_session`，本地开发 `zg_session`，ADR 0007）。职位、聊天、雇主和审核的函数都从会话读出账号和当前身份，不收邮箱（登录一节只在登录和开通雇主身份时带邮箱）；企业每次用 `getAccountEmployer` 从账号查，从不使用浏览器传来的企业编号。
- **未登录：** 需要登录的读操作返回 `null`，聊天的写操作也返回 `null`（不改任何东西）；登录一节的函数返回「请先登录」。
- **结果形状：** 写操作返回带 `ok` 的联合类型，失败时 `error`（登录、举报）或 `error_zh`（雇主、审核）是可以直接显示给用户的中文句子。读操作在没有权限或找不到时返回 `null`、空数组或空对象，不抛错。
- **输入：** 所有参数都在服务器上重新校验（类型、长度、枚举值），浏览器的校验只是提示。
- **国家：** 目前固定新西兰（`DEFAULT_COUNTRY = "NZ"`）。

## 登录与身份 — `src/app/[lang]/login/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
`AccountStatus`（即 `SessionView`）：`{ email, activeRole: "seeker" | "employer", employer?: { id, name } }`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `requestSignInCode(email)` | 邮箱 | `{ ok: true }`，验证码 10 分钟有效。开发和测试环境另带 `devCode`（登录页直接显示），生产环境永远不带 | `{ ok: false, error }`：「请输入正确的邮箱地址」「验证码刚发过，请 N 秒后再获取」（每个邮箱每分钟一次）「邮件服务还没有配置，暂时无法发送验证码」（生产环境，#16）；设了 `SIGN_IN_ALLOWLIST` 时名单外的邮箱回「这个演示站现在只开放给受邀的账号。职位、企业主页可以直接看。」，不发信、不存验证码，防刷计数照算（`src/lib/auth/allowlist.ts`） |
| `signInAccount(email, code, role?)` | 邮箱；6 位数字验证码；想要的身份，默认 `seeker`，账号有企业时才能是 `employer` | `{ ok: true, account: AccountStatus, reload? }`，首次使用时创建账号，并设置会话 cookie（30 天）。账号存过界面语言、又和这个浏览器的不一样时，改写 cookie `zg_lang` 并带 `reload: true`（登录页整页跳转进去）；账号没存过时记下这个浏览器的语言（第 20 轮，ADR 0023） | `{ ok: false, error }`：「请输入正确的邮箱地址」「请输入 6 位数字验证码」「请先获取验证码」「验证码已过期，请重新获取」「验证码不对，还可以再试 N 次」「错误次数太多，请重新获取验证码」（错 5 次作废）；名单外的邮箱（`SIGN_IN_ALLOWLIST`）同上「只开放给受邀的账号」那句，名单设之前发出的验证码也登不进 |
| `accountStatus(email?)` | 可选：浏览器副本里的邮箱 | 当前会话的 `AccountStatus`；浏览器每次加载页面用它校正本机副本。`ADMIN_ENABLED=1` 时带 `staff: "admin" \| "moderator"`（ADR 0043，每次查数据库），界面按它只给审核后台；`signInAccount`、`switchIdentity` 的回答也带 | 没有会话、或会话属于另一个邮箱时 `null` |
| `switchIdentity(role)` | `"seeker"` 或 `"employer"` | 切换后的 `AccountStatus`；账号没有企业时留在求职者身份 | 没有会话时 `null` |
| `openEmployerForAccount(email, choice)` | 邮箱须和会话一致；`choice`：`{ kind: "existing", employerId: "e1" \| "e2" \| "e4" }`（只在打开演示数据时，`demoDataWanted()`；否则服务器拒绝，回「请选择一家店」，登录页也不列演示店，#348）或 `{ kind: "new", name, regionId }` | `{ ok: true, employer: { id, name } }`，并把会话切到雇主身份；已有企业的账号直接返回原企业 | `{ ok: false, error }`：「请先登录」「请选择一家店」「请填写店名」「店名最多 40 个字」「请选择地区」、已被其他账号绑定、企业已停用、找不到企业；「审核员账号只用来审核，不能开通雇主身份。」（ADR 0043） |
| `signOutAccount()` | | 删除服务器上的会话和 cookie | — |

## 界面语言 — `src/i18n/actions.ts`、`src/proxy.ts`（第 20 轮，ADR 0023）

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `setLang(lang)` | `"zh"` 或 `"en"`，别的值当 `zh` | 返回设好的语言：写 cookie `zg_lang`（一年，`Path=/`，`SameSite=Lax`，httpOnly，正式环境加 Secure）；已登录时同时存进 `accounts.lang`。调用后页面整页刷新（`location.reload()`） | — |

- **proxy（每个页面请求都经过，排除 `_next/`、`api/` 和带扩展名的文件）：** 读 cookie `zg_lang`（不是 `en` 就当中文），内部改写到 `/zh/…` 或 `/en/…`，浏览器的地址不变；地址本身带 `/zh`、`/en` 的 308 跳回不带的。Server Functions 的 POST 也经过它，所以返回的出错信息是 cookie 的语言（`requestLang()`）。页面的 GET 顺带发访客 id：职位页从 #79 起，#312 起每个页面都发（自建漏斗要把同一访客的几步串起来，ADR 0025）；Server Function 的 POST 从不发（#90）。
- **出错信息：** 写操作返回的 `error` / `error_zh` 按请求的语言给（字段名照旧），读数据的接口返回的文字（通知、申请状态、提醒条件）也一样。

## 数据与账号 — `src/app/[lang]/account/actions.ts`

账号一律取自会话（#54，ADR 0009）。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myServerData()` | | `{ ok: true, data: ServerAccountData }`：账号、审核员身份、企业和它的全部职位、各身份的聊天记录和已读通知、收藏的职位和求职进度、职位提醒和提醒过的职位、提交过的企业验证申请（#78，不含审核员的邮箱）、看过联系方式的职位、登录会话（只有身份和时间）。浏览器再加上本机的资料、举报和浏览记录，下载成 `zhaogong-my-data-日期.json` | `{ ok: false, error }`：「请先登录」「找不到这个账号」 |
| `deleteMyAccount(email)` | 再输入一次登录邮箱（不分大小写、首尾空格） | `{ ok: true }`：删除账号、所有会话、验证码、聊天记录、收藏、职位提醒和审核员身份；企业的职位下架并清空联系方式；查看记录和「由谁添加」改成 `deleted-account`；企业验证申请保留，提交人邮箱改成 `deleted-account`、联系人姓名清掉，还在等的改为撤回（#78）；删除这次的 cookie | `{ ok: false, error }`：「请先登录」「输入的邮箱和当前登录的邮箱不一致」「你是最后一位审核员。请先在审核后台添加另一位审核员，再删除账号。」 |

## 网页消息推送 — `src/app/[lang]/account/push-actions.ts`

账号和精确登录会话来自cookie（#420，ADR0050）。订阅不可转给其他会话；每次开启需匹配当前scope，最多10条订阅，开启尝试每10秒一次。浏览器用原生Web Locks跨标签串行创建/取消，权限提示只在用户点击后请求。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myPushSettings(endpoint?)` | 可选的明确支持厂商的HTTPS推送地址 | `{ scope, publicKey, enabled }`；缺少或无效VAPID配置时publicKey为null；不返回会话id或private key | 未登录或staff为null |
| `enableMyPush(value, expectedScope)` | 浏览器订阅JSON、当前身份scope | true：校验endpoint、P-256点、auth长度、会话所有权后保存；不覆盖另一会话 | false：未登录、scope/密钥/输入无效、限频、储存上限或被另一会话占用 |
| `disableMyPush(endpoint, expectedScope)` | 推送地址、当前身份scope | true：只删除当前会话+email下该endpoint，不存在也幂等成功；不要求配置密钥或通知权限 | false：未登录、scope或endpoint无效 |
| `disableMySessionPush(expectedScope)` | 当前身份scope；缺少浏览器协调能力时的内部取消兜底 | true：仅删除本次登录会话+email下的全部订阅，停止站点推送；不改其他登录、不尝试不安全的浏览器取消 | false：未登录或scope不符 |

真实新共享聊天文字/简历保存后用Next after最佳努力发送通用提醒；没有正文、联系方式、简历或姓名。发送失败不回滚聊天。API worker无私密页面缓存；点击重新核对当前登录/角色/对话所有权。

## 职位（求职者）— `src/app/[lang]/jobs/[id]/actions.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `revealContact(jobId)` | 职位编号；查看的人取自会话 | `{ phone?, wechat?, email? }`。只对雇主选择公开联系方式（`contactPublic`）、且求职者能看到的职位；同一人对同一职位 30 分钟内只记一次查看 | `null`（未登录、参数无效、职位不公开联系方式、已下架或不存在） |
| `reportJob(jobId, reason, note?, messageIds?, images?)` | `reason`：`fake_job`、`charges_fee`、`below_min_wage`、`discriminatory`、`visa_selling`、`inappropriate`、`other`；`note` 最多 500 字，选 `other` 时必填。不需要登录；`messageIds`（ADR 0027）是要附上的聊天消息，最多 20 条，必须是登录账号自己和这个职位所属企业的对话里的，服务器存举报时的快照；`images`（FormData，字段 `image`）最多 3 张 JPG / PNG / WebP，每张 ≤5 MB，按文件内容判断格式，去掉元数据后存进证据存储；附证据要登录 | `{ ok: true, reportId }` | `{ ok: false, error }`：「请选择举报原因」「补充说明最多 500 字」「选择“其他”时，请简单写一下原因」「找不到这个职位，可能已经下架」「登录已经失效，请重新登录后再附上聊天记录」「选中的聊天记录有变化，请重新选择」「截图最多 3 张」「每张截图不能超过 5 MB」「只能上传 JPG、PNG 或 WebP 格式的图片」「你已经举报过这个职位，我们会尽快核查。」（同一个人对这个职位已经有一条没处理的举报，ADR 0034）「今天的举报次数已经到上限，明天再试。」（每天的上限，ADR 0034） |
| `reportableMessages(jobId)` | 职位编号；账号取自会话 | 举报表单可以附上的消息（ADR 0027）：登录账号和这个职位所属企业的所有对话里最新的 200 条，旧的在前：`{ id, mine, byName, text, sentAt, jobTitle }[]`；职位不公开时是空的 | `null`（未登录） |
| `jobSummary(jobId)` | 职位编号 | `{ id, title, pay, open }`，聊天顶部的职位条用；`open` 表示还在招 | `null` |

## 雇主 — `src/app/[lang]/employer/actions.ts`

账号从会话 cookie 读取（#19），函数不收邮箱参数。除 `parseDraft`、`lookupBusiness` 外都需要雇主身份：已登录，且账号绑定了一家没被停用的企业。没有时读操作返回空结果；写操作返回「请先登录。」（`publishJob` 是 `reason: "signed_out"`）、「需要先开通雇主身份。」或「账号已被停用，不能再修改职位。」。只能操作自己企业的职位，别人的职位一律当作「找不到这个职位。」。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getMyJobs()` | | 本企业所有职位，按发布时间从新到旧，任何状态 | `[]` |
| `getMyJob(jobId)` | | 本企业的这个职位 | `null` |
| `getMyJobNumbers()` | | `{ [jobId]: { views, chats, contactViews } }`（#55）：浏览次数（同一浏览器同一天只算一次）、发起聊天的求职者人数（每人每职位一次）、查看联系方式次数。只有数字，不给是谁 | `{}` |
| `getMyLiveJobsTitled(titleZh)` | 正在写的职位名称 | 本企业招聘中或审核中、还没截止、名称读起来一样（去掉空格、全角半角、大小写）的职位 `{ id, titleZh, status, expiresAt }[]`（#196），发布页预览和复制、重新发布的表单拿来提示 | 没登录、没企业、被停用或名称不是字符串时 `[]` |
| `getMyJobsOverview(options?)` | `{ withPosters: true }` 时带上发布人 | `{ jobs, numbers, renewals, applications, posters }`（#188）：上面 `getMyJobs`、`getMyJobNumbers`、`getMyJobRenewals`、`getMyApplicationCounts`、`getMyJobPosters` 的结果一次给，职位管理、工作台、推荐人才都用它（浏览器里的 Server Function 一个接一个跑，分开取要 4–5 次往返）。检查和它们一样：要登录，企业从账号查，被停用的企业或已经离开团队的人什么都拿不到 | 全是空的（`jobs: []`，`posters` 是 `{ teamSize: 0, posters: {}, contactsFrom: {} }`） |
| `getMyJobPosters()` | | `{ teamSize, posters: { [jobId]: poster } }`（#182）：企业每个职位是谁发的，按看的人说：`{ kind: "you" }`、`{ kind: "teammate", name }`（团队里的称呼，没设就是邮箱）、`{ kind: "left", email }`（已离开团队）、`{ kind: "deleted" }`（已删号）；#182 之前的职位不在里面。`teamSize` 是团队现在的人数。`contactsFrom`（#186）：公开联系方式、而且联系方式是已离开团队的人（`left`）或已删号的账号（`deleted`）填的职位 | 没有企业时 `{ teamSize: 0, posters: {}, contactsFrom: {} }` |
| `getMyJobRenewals()` | | `{ [jobId]: { count, lastAt } }`（#69）：每个职位续期过几次、最近一次的时间；没续期过的职位不在里面 | `{}` |
| `getMyJobDays(jobId)` | 本企业的职位 | `{ job, days, funnel }`：最近 14 个新西兰日，从旧到新，每天 `{ day, views, chats, contactViews }`，没有数据的日子是 0；`funnel` 是从发布到现在的 `{ applied, interviewed, hired }`（#105：申请人数、约过面试的人数，不算已取消的、录用人数） | `null`（未登录、不是雇主、不是本企业的职位） |
| `parseDraft(text)` | 招聘文字，最多取前 5000 字 | `ParsedPost`：`{ draft, missing, notes_zh }`（规则解析，以后换成模型调用，签名不变） | — |
| `chatTurn(state, message)` | 浏览器保存的对话状态（服务器先重建和清洗）；本轮输入 | 下一轮的 `ChatState`（问题、快捷选项、草稿）。生产环境由 Claude 回答（#102，`src/lib/ai-post/model/`）：模型用结构化输出交回下一句话、快捷回复和草稿字段，服务器再用 `sanitizeDraft` 清洗、跑合规规则。没配 key、超时或出错时 `unavailable: true`，对话里说明「暂时不可用」。调用模型（`claude`、`fake`）要登录，没登录时 `unavailable: true`，说「登录后才能用 AI 发帖助手」。**限额**：每个账号最近 60 秒 6 次、最近 24 小时 100 次，超了不调用模型，`unavailable: true`，说明稍后再试或明天再继续。每次调用在 `ai_usage` 记一行（模型、四种 token、结果 `ok` / `error` / `refused` / `unreadable`，被限额挡下的记 `limited`）；脚本不计数，也不记 | — |
| `chatAssistantKind()` | — | 谁在回答：`claude`、`unavailable`（生产环境没配 key）、`script`（开发环境的规则脚本，页面标明不是 AI）、`fake`（开发和测试用的固定回答模型，浏览器带 `zg_ai_fake=1` cookie 时） | — |
| `publishJob(input)` | 职位草稿，服务器重新清洗和检查 | `{ ok: true, job }`，状态是 `active`，命中需人工审核的规则时是 `pending_review`；发布人记成会话里的账号（`jobs.posted_by_email`，#182），不在 `job` 里，公开页也没有 | `{ ok: false, reason, findings, missing }`：`signed_out`、`no_identity`、`banned`、`not_ready`（有拦截或必须改写的问题，或必填项没填） |
| `editMyJob(jobId, input)` | 修改后的草稿 | `{ ok: true, job }`；在线的职位改出需审核的内容会回到审核；联系方式改了的话，记成改的人填的（`jobs.contact_by_email`，#186） | `{ ok: false, error_zh, findings? }`：「这个职位已被下架，不能修改。」「还有问题没处理或必填项没填。」 |
| `closeMyJob(jobId, hires?)` | `hires`：`{ hired: true, count: 1–20 }` 或 `{ hired: false }`，可省略 | `{ ok: true, job }`，状态 `expired` | 「这个职位已经结束或已被下架。」「人数请填 1 到 20。」 |
| `confirmHires(jobId, hires)` | 同上，用于事后更正 | `{ ok: true, job }` | 「职位结束后才能记录招到几人。」「请选择招到了，或者没有 / 不确定。」 |
| `refreshMyJob(jobId)` | | `{ ok: true, job }`：在招的职位排到前面，至少再开 30 天（续期后更晚的截止日不变） | 「不能刷新：…」（24 小时内只能刷新一次、已截止等）、「这个职位不符合现在的发布规则，请先编辑。」 |
| `renewMyJob(jobId, days)` | `days`：14、30 或 60 | `{ ok: true, job }`（#69）：截止日从原来的日期往后推（已截止的从现在算），位置不变；先按现在的规则检查，已截止的职位重新上线或进审核；记一条续期 | 「不能续期：…」（审核中、已被下架、截止超过 14 天、已经排到 90 天后）、「请选择续期 14、30 或 60 天。」「续期 N 天会超过最远的截止日，请选短一些的。」「这个职位不符合现在的发布规则，请先编辑。」（带 `findings`） |
| `getMyEmployer()` | | 账号绑定的企业（含验证状态、是否被停用） | `null` |
| `lookupBusiness(query)` | 公司名或 NZBN，最多 100 字 | `{ results: RegisterEntry[], error_zh? }`（演示登记表，以后换成 NZBN 接口） | — |
| `requestVerification(input)` | `{ nzbn, kind?, contactName, contactRole, companyPhone, website? }`；`kind` 是 `business_verified`（默认）或 `accredited_employer` | `{ ok: true, request }`（#78）：申请记为待审，企业的标识**不变**，等审核员通过。`request` 不含任何邮箱 | `{ ok: false, error_zh }`：「请先在企业登记里选好你的公司。」「请填写联系人姓名。」「请填写你在公司的职务。」「请填写公司电话…」「网站或 Facebook 请填完整的网址…」「企业登记里没有这个 NZBN。」「这家公司在企业登记里已注销，不能用来验证。」「你已经有一份验证申请在审核中…」「这个 NZBN 已经有一份验证申请在审核中。…」「这个 NZBN 已经被其他店铺验证。…」「你的店铺已经是「…」。」「账号已被停用，不能申请验证。」 |
| `getMyVerification()` | | 本企业最近一份申请（`pending`、`approved`、`rejected` 或 `withdrawn`，被驳回的带 `rejectReason`、`rejectNote`），不含邮箱和核对清单 | `null`（没申请过、未登录、不是雇主） |

`findings` 的每一项：`{ level: "block" | "rewrite" | "review", field, message_zh, rule, matches }`（`src/lib/compliance/`）。

`requestVerification` 只有团队管理员能调用（#87），成员调用时返回「只有团队管理员能申请企业验证，请找你们店的管理员。」。

## 团队 — `src/app/[lang]/employer/team-actions.ts`

雇主多人管理（#87，ADR 0012）。人和企业都从会话读。没有雇主身份时读操作返回 `null` / `[]`，写操作返回「需要先开通雇主身份。」。只有管理员能邀请、撤回、改身份和移出；拒绝时的文字：「只有管理员能管理团队。」「团队里至少要有一位管理员：先把另一位成员设为管理员。」「这个人已经不在团队里了。」「你已经不在这家企业的团队里了。」。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getMyTeam()` | | `{ employer: { id, name }, me: { email, role, name }, members, invites, links }`：成员按管理员在前、加入时间排序，每人 `{ email, role, name, joinedAt }`；`invites` 是没回复的邀请 `{ id, email, role, createdAt, expired }`，只给管理员（成员是 `[]`）；`expired` 是 14 天没回复、已经过期（#194）；`links` 是还没用掉、没撤销的邀请链接 `{ id, createdBy, createdAt, expiresAt, expired }`（#349），不含链接本身，只给管理员 | `null` |
| `inviteTeammate(email, role)` | 对方注册找工用的邮箱；`role` 是 `admin` 或 `member`（默认） | `{ ok: true }` | 「请填写对方注册找工用的邮箱。」「这个邮箱还没有注册找工。…」「这个人已经在团队里了。」「这个账号已经属于另一家企业，不能再加入。」「已经邀请过这个人，等对方回复。」「团队最多 10 人（包括还没回复的邀请和还没用掉的链接）。」「这家企业 24 小时内已经发了 20 条邀请，明天再邀请。」（#197；邀请链接一起算，#349） |
| `cancelTeamInvite(inviteId)` | | `{ ok: true }` | 「这条邀请已经回复或撤回了。」 |
| `changeMyTeam(change)` | `{ type: "role", email, role }`、`{ type: "remove", email }` 或 `{ type: "leave" }` | `{ ok: true }`；退出后会话切回求职者身份 | 见上；「看不懂这个操作。」 |
| `setMyTeamName(name)` | 称呼，去掉首尾空格后 1–12 个字，不能有邮箱或电话 | `{ ok: true, name }` | 「请填写称呼，例如「王经理」。」「称呼最多 12 个字。」「称呼里不要写邮箱或电话。」 |
| `getMyTeamInvites()` | | 发给自己、没回复的邀请 `{ id, employerName, role, createdAt }`，旧的在前；已经有企业时是 `[]`；被封禁的企业和过期（14 天没回复，#194）的邀请不列 | `[]` |
| `answerTeamInvite(inviteId, answer)` | `{ accept: true, name }` 或 `{ accept: false }` | `{ ok: true, employer? }`：接受时带上企业，会话已切到雇主身份 | 称呼的错误同上；「这条邀请已经撤回或回复过了。」「你的账号已经属于一家企业，不能再加入别的企业。」「这个团队已经满 10 人了。」 |
| `createTeamInviteLink()` | | `{ ok: true, path, expiresAt }`：`path` 是 `/employer/team/join/<令牌>`，令牌是 32 个随机字节（base64url）；**只在这一次回答里出现**，库里只存它的 SHA-256（#349，ADR 0028）。7 天后过期 | 只有管理员；「团队最多 10 人（包括还没回复的邀请和还没用掉的链接）。」「这家企业 24 小时内已经发了 20 条邀请，明天再邀请。」 |
| `revokeTeamInviteLink(linkId)` | `links` 里的 `id` | `{ ok: true }` | 只有管理员；「这条链接已经用过或撤销了。」 |
| `joinTeamWithLink(token, name)` | 链接里的令牌；团队里的称呼（同 `setMyTeamName`） | `{ ok: true, employer? }`：以**成员**加入，链接记成用过，会话切到雇主身份 | 「请先登录。」；称呼的错误同上；「这条邀请链接不对：…」「这条邀请链接已经过期（7 天内有效）。…」「这条邀请链接已经用过了，…」「这条邀请链接已经被管理员撤销了。」「这家店已被封禁，不能加入。」「你已经在这家店的团队里了。」「你的账号已经属于一家企业。…」「这个团队已经满 10 人了，…」 |

邀请链接存在 `team_invite_links`（迁移 0029）：`id`、企业、令牌的哈希、生成人、生成时间、状态（`open` / `used` / `revoked`）、使用人和使用时间。过期在读取时判断（`LINK_DAYS` = 7，`linkExpired`）。没过期、没用掉的链接和邮箱邀请一样占团队的名额。数据函数在 `src/db/team-links.ts`；打开链接的页面直接读 `teamLinkState(token)`，不经过 Server Function。

## 门店照片和福利 — `src/app/[lang]/employer/photo-actions.ts`

企业主页的门店照片和福利（F8，ADR 0052）。人和企业都从会话读；没登录、是求职者身份或没有企业时都返回 `null`。只有团队管理员能上传、删除和改福利，数据库写的那一句再查一次（ADR 0031）；成员调用时回答里带「只有团队管理员能上传或删除门店照片、修改福利。」、`error: true`。企业被封禁时（暂时封禁也算，ADR 0044）照片和福利都不能改：快照里 `canEdit` 为 `false`、带 `banned`（和其他页一样的封禁提示），上传、删除、存福利都回答这句提示、`error: true`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myCompanyPhotos()` | | `CompanyPhotosSnapshot`：`{ scope, employerId, photos, benefits, canEdit, banned? }`。`photos` 按上传时间从旧到新，每张 `{ id, status, reason, uploadedAt, reviewedAt }`：等审、通过的，和 30 天内被退回的（只有理由，没有图）；删掉的不列；顺手清理本企业的（同 `purgeExpiredPhotos`） | `null` |
| `uploadCompanyPhoto(form)` | `FormData`，字段 `photo`：浏览器先缩到长边 1600 像素（WebP，不行就 JPEG） | `{ snapshot, said: "已上传，等审核员看过就会公开。" }`：服务器按字节认类型（JPG、PNG、WebP），去掉元数据，先占一行（等审）再存文件，存不进就删掉那一行；存完再看那一行还在不在（同时删号、删照片），不在就删掉刚存的文件、回答「上传没有成功」 | `{ snapshot, said, error: true }`：「只能上传 JPG、PNG 或 WebP 图片。」「这张图片不完整，请重新保存后再上传。」「这张照片太大了…」（2 MB 以上）、「已经有 6 张了：删掉一张再上传。」「今天上传的照片太多了，请明天再试。」（24 小时 20 次，退回的、删掉的也算）、「上传没有成功，请再试一次。」 |
| `removeCompanyPhoto(id)` | 本企业照片的编号，什么状态都行 | `{ snapshot, said: "照片已删除。" }`：先把行标成删掉（`status = "removed"`，谁都看不到、不导出），再删文件；行留一天照样算进当天的上传次数，之后清理时删掉；文件没删掉的写服务器日志，清理时补删 | 只有管理员；别家的照片当作没有，照样回答「照片已删除。」 |
| `saveCompanyBenefits(benefits)` | 勾选的福利，只认 `BENEFITS` 里的 8 项（`src/lib/company-photos.ts`） | `{ snapshot, said: "已自动保存，企业主页上马上能看到。" }`（页面每勾一项就调一次）：马上显示在企业主页上，不用审核；还没有企业主页的企业建一个空的 | 只有管理员；不是数组时 `null` |

照片文件只经 `GET /api/company-photos/[id]` 交出（见「页面路由」）。被退回时雇主的通知里有一条「有一张门店照片被退回」（`src/app/[lang]/employer/photo-notifications.ts`，读通知不写数据库），点进 `/employer/photos`。删号时企业跟着最后一个人删掉的话，照片的行和文件一起删；「导出我的数据」列出照片的编号、状态和时间，没有图（和照片页一样：不含删掉的、30 天前退回的）。

**每天清理一次**（`purgeExpiredPhotos`，`src/db/employer-photos.ts`；和举报截图的 `purgeExpiredEvidence` 一样不用定时任务，ADR 0008）：每个新西兰日第一次有人上传照片、或审核员第一次打开照片队列时跑，所有企业一起：补删退回、删掉时没删成的文件；删掉 30 天前退回的行、上传超过一天的删掉的行（只删文件已经没了的）。存储没回应时下一次调用再跑，不等第二天；跑失败只写服务器日志，不挡上传和队列。

## 职位浏览计数 — `src/app/[lang]/employer/count-view.ts`

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `countJobView(jobId)` | 职位编号；职位页每次加载调用一次 | 用浏览器的随机编号（httpOnly cookie `zg_visitor`，一年；页面的响应由 `src/proxy.ts` 先发给没有编号的浏览器，#79，#312 起每个页面都发，只随打开页面本身的请求发，不随 Next 的预取和站内跳转发，ADR 0025 §3；这里从不设 cookie，缺失时用一次性的编号计数，#90），存它的 SHA-256；同一浏览器同一职位同一新西兰日只记一次。不存 IP，不关联账号。企业看自己的职位不算 | 职位不存在、待审核或已下架时什么都不做 |

## 聊天、交换和通知 — `src/app/[lang]/messages/actions.ts`

每个身份（邮箱 + 身份 + 企业，`identityScope`）有自己的一份聊天记录：会话里的消息、已读、交换请求和回应、聊天举报（`ChatRecord`，`src/components/seeker/chat-store.ts`），存在数据库的 `chat_records` 表（#42）。服务器上的这一份是准的；浏览器 `localStorage` 里的是缓存，跟着服务器的回答更新。每次回答都带 `scope`，浏览器只在对应的身份下采用。

`ChatSnapshot`：`{ scope, record: ChatRecord, opened?, notice? }`。`record` 是这个身份自己的记录加上它和对方共用的对话（#110，ADR 0015）；`opened` 只在 `open` 之后有，是要进的对话编号；`notice` 是因为超过自己记录的上限而没收下时的说明，用访客的语言，浏览器用提示条显示。

**自己记录的上限**（安全检查 F，`src/lib/chat-server/own-limits.ts`）：自己的记录只放演示账号的演示对话、和演示候选人的对话、#10 之前的记录（真实的聊天是共用对话，存在自己的表里），每次改动都整份重写，所以要小：最多 100 段对话，每段最多新加 200 条消息；导入的记录另外最多 100 条举报，每条消息和证据不超过 2000 字。`ReadsSnapshot`：`{ scope, ids: string[] }`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myChat()` | | 当前身份的 `ChatSnapshot`，还没有记录时是空记录 | 未登录时 `null` |
| `changeMyChat(change, ticket?)` | `change` 见下表；`ticket`：`{ id, scope }`，浏览器待发送队列里这一项的编号（8–64 位字母、数字、连字符）和它产生时的身份 | 改动后的 `ChatSnapshot`。带 `ticket` 时同一编号只应用一次（每个身份记最近 200 个），`scope` 和当前会话不一致时不应用（切换身份期间浏览器稍后重发） | 未登录时 `null`；改动不合规则时原样返回当前记录，不报错 |
| `importMyChat(record)` | #10 之前只存在浏览器里的记录 | 服务器还没有这个身份的记录时，校验后存下并返回；已有记录时返回服务器的，不覆盖 | 未登录时 `null`；格式不对时返回空记录；超过自己记录的上限时不存，返回空记录和 `notice` |
| `myNotificationReads()` | | 当前身份已读的通知编号 | 未登录时 `null` |
| `markMyNotificationsRead(ids)` | 通知编号数组，或 `"all"` | 合并后的已读编号；只收这个身份确实有的通知（求职者身份包括职位提醒的 `alert:<职位编号>`） | 未登录时 `null` |

`changeMyChat` 的 `change`（服务器用和浏览器同一套纯函数检查和应用，时间和编号由服务器生成）：

| `type` | 其余字段 | 规则 |
| --- | --- | --- |
| `open` | `conversation`：`{ kind: "employer", jobId }`（求职者找雇主）、`{ kind: "applicant", jobId, applicationId }`（雇主找申请人）或 `{ kind: "candidate", jobId, candidateId, name }`（雇主找候选人） | 职位须在招且没过期；雇主没被封禁，不能和自己的企业聊；找申请人、候选人只能用自己企业的职位。对方是账号时（求职者找雇主、申请人、主页在账号上的候选人 `local-…`）打开双方共用的对话（#110），名字以服务器为准；演示候选人的对话记在企业自己的记录里，已有 100 段时新的打不开，回答带 `notice`。回答的 `opened` 是要进的对话编号，打不开时没有 |
| `send` | `conversationId`、`text` | 对话须存在；去掉首尾空白后 1–2000 字；自己记录里的对话已有 200 条新消息时不收，回答带 `notice`；共用对话已有 500 条消息时也不收（ADR 0015）。求职者在从职位页发起的对话（`employer:<企业>:<职位>`）里发消息时，给那个职位记一次「发起聊天」，每人每职位只记一次（#55）。企业一方在共用对话里发的消息碰到聊天规则（收费、卖签证或担保收费、刷单、按种族招人，`checkChatMessage`）时，写进之后记一条聊天风险（`recordChatRisk`，`src/db/chat-risk.ts`，#384，ADR 0039）：哪家企业、哪段对话哪条消息、哪几类、时间，不另存内容；7 天内够 3 条就给审核员开一项。求职者发的不记；记失败不影响发送 |
| `resume` | `conversationId`、`resume`：浏览器按「中英文简历」页打印出来的那一份（`ResumeDoc`） | 求职者发自己的中英文简历（#379，ADR 0037）：只在和企业共用的对话里（`employer:<企业>:<职位>`，和 `send` 一样可以是第一句、会给职位记一次「发起聊天」），演示对话、企业一方发的都不收。服务器照分享链接的规则重新解析，没有称呼不收；联系方式照求职者勾的带上（邮箱也带，分享链接不带）。存成一条消息（`messages.resume`，文字 `[简历]`），占共用对话 500 条里的一条。双方看到的是卡片：`Message.resume` = `{ id, name, contact }`，`text` 是读的人语言里的「[简历] 名字」；整份只在 `/messages/resume/[id]` 给双方看 |
| `read` | `conversationId` | 把这个对话标为已读（共用对话记在自己这一侧；企业一方团队里谁读都算） |
| `request` | `conversationId`、`kind`：`contact` 或 `resume`、`payload` | 发起交换，发起方先附上自己的资料（ADR 0002） |
| `answer` | `conversationId`、`exchangeId`、`status`：`accepted`、`rejected`、`cancelled`，同意时带 `payload` | 同意时必须附上自己的资料 |
| `report` | `conversationId`、`reason`、`note`、可选 `messageIndex` | 举报对方的一条消息（只能是对方发的）或整段对话，证据取被举报的那条或最近 100 条；举报存在自己的记录里，已有 100 条时不收，回答带 `notice`（`src/lib/chat-server/own-limits.ts`）。这和每天能举报几次（职位举报的 ADR 0034）无关 |

## 聊天常用语和开场白 — `src/app/[lang]/messages/phrases-actions.ts`

常用语（#372）和求职者的开场白（#373），存在账号上（`accounts` 的三列，迁移 0034，ADR 0035）。`ChatPhrases`：`{ seeker, employer, opener }`，`seeker`、`employer` 是各自身份的常用语数组，`opener` 是 `{ template: 1–3 }` 或 `{ text }`；没改过的是 `null`，浏览器显示页面语言下的默认文字（开场白默认模板 1）。上限和解析在 `src/lib/chat-phrases.ts`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myChatPhrases()` | | `{ email, phrases: ChatPhrases }` | 未登录时 `null` |
| `saveMyChatPhrases(save)` | `{ role: "seeker" \| "employer", phrases?, opener? }`：`phrases` 是数组或 `null`（恢复默认），`opener` 是选择或 `null`（回到模板 1）；没传的不动 | `{ ok: true, email, phrases }`，存后的全部。常用语去掉首尾空白、空的丢掉 | 未登录或格式不对时 `null`；超过 10 条、某条超过 60 字、开场白超过 200 字或是空的、任何一条带电话、微信、邮箱（`readContact`）时 `{ ok: false, why }`，`why.problem` 是 `too_many`、`too_long`、`empty` 或 `contact`（带 `index`、`found`），什么都不存 |

## 和找工审核员的对话 — `src/app/[lang]/messages/moderator-chat-actions.ts`

#407（ADR 0046）。企业和审核员的一段对话，企业取自账号（`accounts.employer_id`）：雇主身份时给；企业正被封着时（ADR 0044），求职者身份也给。`ModeratorChatView`（`src/lib/moderator-chat.ts`）：`{ employerId, employerName, lines, unread }`，`lines` 每条是 `{ id, mine, text, sentAt, by?, read? }`：`mine` 是企业团队发的，`by` 是团队里的称呼（审核员发的没有 `by`，企业看不到是哪位审核员），自己这边的带 `read`（审核员读了没有）；`unread` 是审核员发的、团队还没读的条数。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myModeratorChat()` | | `ModeratorChatView` | 未登录、没有企业、不是这家企业的身份、或还没有对话时 `null` |
| `readMyModeratorChat()` | | 团队读到现在 | 同上时什么都不做 |
| `sendToModerators(text)` | 文字，去掉首尾空白后 1–2000 字 | `{ ok: true, view }`，发后的整段 | `{ ok: false, error }`：空的、太长、没有对话、到 500 条上限 |

## 收藏和进度 — `src/app/[lang]/me/saved/actions.ts`

#52（PRD R-28）。按账号存在 `saved_jobs` 表（迁移 0004），账号取自会话；只有本人读得到，雇主和别的账号都读不到。「实习」「专业职位」的外部职位（#131，ADR 0020）存在 `saved_external_jobs`（迁移 0021），在这些函数里的编号写成 `external:<外部职位编号>`（`externalSaveKey`）；只有分区里正在显示的外部职位能收藏。

`SavedJobView`：`{ jobId, href, external, titleZh, titleEn, pay?, payText?, country, region?, employerName?, gone, savedAt, stage, picked }`。外部职位的 `external` 为 `true`，`titleZh` 是英文职位名，`titleEn` 为空，薪资写在 `payText`（原文写了才有），`region` 是城市，`employerName` 是公司，`href` 是 `/external/<编号>`；外部职位的进度只能自己选，不看聊天。`gone` 表示职位已下架、过了截止时间或雇主被停用，外部职位是分区里不再显示（照样列出，页面标「已下架」）。`stage` 是 `saved`（已收藏）、`contacted`（已联系）、`interviewed`（已面试）、`hired`（已录用）、`rejected`（没成）之一。`picked` 为 `false` 时进度由聊天决定：这个职位的聊天里双方同意交换过联系方式就是 `contacted`，否则 `saved`；用户选过之后以用户选的为准。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `mySavedJobIds()` | | 收藏的职位编号，新的在前（收藏按钮用） | 未登录时 `null` |
| `mySavedJobs()` | | `SavedJobView[]`，新的在前 | 未登录时 `null` |
| `saveMyJob(jobId)` | 职位编号 | 收藏后的编号列表；已收藏过的保留原来的时间和进度 | 未登录时 `null`；职位不存在时不改动 |
| `unsaveMyJob(jobId)` | 职位编号 | 取消后的编号列表，进度一起删除 | 未登录时 `null` |
| `setMyJobStage(jobId, stage)` | 职位编号；上面五个进度之一 | 改后的 `SavedJobView[]` | 未登录时 `null`；不是这五个之一、或职位没收藏时不改动 |

未登录点「收藏」会去 `/login?next=<原页面>?save=<职位编号>`，登录后回到原页面，由页面完成收藏并去掉 `save` 参数。

## 我的举报 — `src/app/[lang]/me/reports/actions.ts`

S2（#390，ADR 0041）。`/me/reports` 列这台设备记着的职位举报，状态从这里来。开着的举报带着发的人的编号（`reporterKey`，ADR 0034），关掉时清空，所以只能说「还开着」或「不在了」。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myOpenReports()` | | 这个浏览器发的、还开着的举报编号：登录了按账号和访客编号两个算，没登录只按访客编号；两样都没有时 `[]`。不回别的字段，也不按编号查（编号是顺序的） | — |

## 申请职位和聊过的人 — `src/app/[lang]/jobs/[id]/apply-actions.ts`、`src/app/[lang]/employer/applicant-actions.ts`

**2026-10-20 用户定删掉职位页和职位块上的「申请」**：求职者这边只剩读（`myAppliedJobIds`、`myApplicationViews`）。**候选人改成「这个职位聊过的人」（ADR 0030，迁移 0030）**：`job_applications` 加 `source`（`apply` / `chat`），双方共享的对话里第一条消息发出时插一行 `chat`（`note`、`profile` 都是 `null`，建的时候就算看过）；申请和撤回的函数、`POST /api/dev/apply` 都删了。

#84（PRD R-35）。存在 `job_applications`（迁移 0010）：账号 + 职位唯一，附言最多 200 字，`profile` 是申请时求职者主页的一份（`ApplicationProfile`：名字、一句话介绍、所在地、语言、可上班时间、介绍和简历要点，不含头像和联系方式；服务器用 `parseApplicationProfile` 重新检查）。账号取自会话；雇主只通过申请的随机编号操作，看不到求职者的邮箱。撤回就是删除。

求职者（`MyApplication`：`{ jobId, source, appliedAt, note, status }`，`status` 是「已申请，等雇主查看」「雇主已看过」「雇主觉得合适」之一，「不合适」也显示「雇主已看过」；`chat` 行没有附言，`status` 是「聊过」，标了合适是「雇主觉得合适」）：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myAppliedJobIds()` | | 申请过的职位编号（职位块的「已申请」，不含只聊过的） | 未登录时 `null` |
| `myApplicationViews()` | | `MyApplication` 加职位名、时薪、地区、企业名、`gone` 和 `stage`（#105：`open` 进行中，`ended` 已录用或职位已结束），新的在前（「收藏和进度」的「我的申请」）。职位结束后，没被录用的申请 `status` 是「职位已结束」，标没标「不合适」都一样 | 未登录时 `null` |

雇主（只看自己企业的职位）：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getMyApplicationCounts()` | | `{ [jobId]: { total, unseen } }`，`total` 是聊过和申请的人，`unseen` 只数申请；没有候选人的职位不列 | 没有雇主身份时 `{}` |
| `getMyJobApplicants(jobId)` | 职位编号 | `{ job, applicants }`，先来的在前；每人 `{ id, source, name, appliedAt, note, profile, facts, isNew, decision }`，`facts` 是雇主先看的五项（R-18），`isNew` 是还没看过的；`chat` 行的 `note`、`profile` 是 `null`、`facts` 是空的，`name` 是聊天里看到的名字（不知道时是空字符串）。只读，不改动 | 不是自己企业的职位时 `null` |
| `markMyApplicantsSeen(jobId)` | 职位编号 | 列表显示出来后调用：这个职位的申请都标为看过，求职者看到「雇主已看过」 | 不是自己企业的职位时不改动 |
| `decideMyApplicant(applicationId, decision)` | 申请编号；`"fit"`、`"unfit"`、`"hired"`（已录用，#105）或 `null`（取消） | `true` | 不是自己企业的申请或值不对时 `false` |
| `getMyChatCandidate(conversationId)` | 雇主一侧的对话编号 `chat:<id>` | `{ decision }`（没标或还没人说话时 `null`），聊天职位条下的「合适」「已录用」用 | 不是自己企业的共享对话时 `undefined` |
| `decideMyChatCandidate(conversationId, decision)` | 同上；值同 `decideMyApplicant` | `true`；还没有候选人行时先插一行 `chat` | 不是自己企业的共享对话或值不对时 `false` |

雇主的「通知」（`myAlertNotifications`）每个申请一条（编号 `apply:<申请编号>`，雇主看过列表后算已读，也可以用 `markMyNotificationsRead` 标已读），点开到申请人列表；工作台「待办」按职位列出「N 个新申请」。雇主点「发起聊天」时 `changeMyChat` 收到 `{ type: "open", conversation: { kind: "applicant", jobId, applicationId } }`，服务器核对这份申请属于这个职位和这家企业后，打开和这位求职者共用的对话（#110 之前是企业自己记录里的 `apply:<申请编号>`），回答里的 `opened` 是 `chat:<对话编号>`。

## 时薪参考 — `src/app/[lang]/jobs/pay-reference-actions.ts`

#85（PRD R-36）。用平台上在招的职位（`listJobs`）现算，不存表；职位详情在服务器上直接算，发布表单调这个函数。计算在 `payReference()`（`src/lib/pay-reference.ts`）：同一行业，同一地区至少 5 个时用地区（`scope: "region"`），否则用同一大区（`"area"`，如「全奥克兰」），还不够时 `scope: "none"` 只给个数。`min`、`max` 是时薪范围的两端，`median` 是每个职位范围中间值的中位数。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `payReferenceFor(industry, regionId, exclude?)` | 行业；地区（可不填）；不计入的职位编号（编辑中的职位） | `{ reference, at }`：`reference` 是 `{ scope, place, min, median, max, count }` 或 `{ scope: "none", count }`；`at` 是计算时间 | 行业不认识时 `null` |

## 企业主页 — `src/app/[lang]/employer/page-actions.ts`

#181，ADR 0022。企业主页存在 `employer_profiles`（迁移 0022）：企业是主键，`page` 是改过的内容，只有公开的几项（名称、招聘简介、地区、招聘联系人、沟通语言、联系时间、企业介绍、头像；`parseEmployerPage`），私密交换资料不上服务器。人和企业都从会话读；团队里每个人都能读，只有管理员能存。浏览器怎么同步见 `src/components/seeker/profile-client.ts`。

`EmployerPageSnapshot`：`{ scope, page, updatedAt, canEdit, admins }`。`scope` 是回答对应的身份；还没人存过时 `page`、`updatedAt` 是 `null`；`canEdit` 是这个人能不能改，`admins` 是管理员的称呼（没设称呼就是邮箱）。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myEmployerPage()` | | 企业主页的 `EmployerPageSnapshot` | 未登录、求职者身份或没有企业时 `null` |
| `saveMyEmployerPage(page)` | 浏览器里的整份主页（只留企业的那几项） | 存下后的 `EmployerPageSnapshot`；成员存时什么都不改，回答里 `canEdit` 是 `false`；有不能公开的内容（收费、卖签证、种族偏好、电话、微信、邮箱）时也不存，回答里 `refused: [{ field, message_zh }]`（#195） | 未登录、求职者身份、没有企业、不是主页或超过 250 kB 时 `null` |
| `employerPublicPages(employerIds)` | 企业编号的数组，一次最多 50 个；不用登录 | `{ [employerId]: { name, headline, location, languages, availability, bio, contactName, avatar? } }`：`name` 没填时是企业名称 | 还没有主页、被封禁或编号不对的企业不在回答里；参数不是数组时 `{}` |

## 我的主页 — `src/app/[lang]/profile/actions.ts`

#104（PRD 第 17 轮）。求职者主页存在 `seeker_profiles`（迁移 0019）：账号是主键，`profile` 是用户改过的内容（和浏览器存的一样，`parseProfilePatch` 的形状），`updated_at` 是最后一次保存。账号取自会话，只有求职者身份能读写；企业主页见上一节。浏览器怎么和它同步见 `src/components/seeker/profile-client.ts` 和 ADR 0017。

`ProfileSnapshot`：`{ scope, profile, updatedAt }`，`scope` 是回答对应的身份（浏览器只在当前身份相同时才用），账号还没存过时 `profile`、`updatedAt` 是 `null`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myProfile()` | | 账号上的主页 `ProfileSnapshot` | 未登录或雇主身份时 `null` |
| `recommendedCandidates()`（`src/app/[lang]/profile/candidate-actions.ts`） | | 雇主身份：`{ scope, candidates }`，账号上允许推荐、填了称呼的求职者主页，只有公开字段（`recommendableCandidates`），不含自己的求职主页 | 未登录或求职者身份时 `null` |
| `saveMyProfile(profile)` | 浏览器里的整份主页 | 存下后的 `ProfileSnapshot`（只留服务器读得懂的字段，头像最多 180 kB） | 未登录、雇主身份、不是主页或超过 250 kB 时 `null` |

## 中英文简历的分享链接 — `src/app/[lang]/profile/resume/actions.ts`

#86（PRD R-37）。简历本身在浏览器里生成（`resumeDocFrom`，`src/components/seeker/resume-doc.ts`），打印不经过服务器。分享时存在 `resume_shares`：账号是主键（每个账号最多一条），`id` 是链接里的随机编号（18 个随机字节，base64url），`resume` 是分享时的简历（`ResumeDoc`：中文和英文各一份文字、简历要点、签证、勾选的电话和微信）。服务器用 `parseResumeDoc` 重新检查和截断，丢掉邮箱。账号取自会话，只有求职者身份能分享。

`ResumeShareView`：`{ path, updatedAt, resume }`，`path` 是 `/resume/<id>`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myResumeShareLink()` | | 打开着的链接 `ResumeShareView` | 没有链接、未登录或雇主身份时 `null` |
| `shareMyResume(resume)` | 浏览器生成的简历 | `{ ok: true, share }`；已经有链接时更新内容，链接不变 | `{ ok: false, error }`：未登录、雇主身份、没有称呼 |
| `closeMyResumeShare()` | | `true`，链接从此打不开 | 没有链接或未登录时 `false` |

## 约面试 — `src/app/[lang]/employer/interview-actions.ts`、`src/app/[lang]/me/interview-actions.ts`

#103。存在 `interviews`（迁移 0015）：每个申请最多一条（`application_id` 唯一）。`InterviewView`：`{ status, slots, callFirst, mode, place, note, chosenSlot, reply, invitedAt, respondedAt }`；`status` 是 `proposed`（等求职者）、`confirmed`、`counter`（求职者说这些时间不行，`reply` 是他写的方便时间）、`declined`、`cancelled`（雇主取消）。`slots` 是 UTC 时刻，页面按奥克兰时间显示（`src/components/seeker/interviews.ts`）。邀约不带联系方式。

雇主（只能操作自己企业的申请，按申请编号）：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `inviteMyApplicant(applicationId, invite)` | `{ slots, callFirst, mode, place, note }`：任意个时间（最多 20），或 `callFirst: true`（电话联系后再定，`slots` 忽略） | `{ ok: true, interview }`；已有邀约时替换，重新变成 `proposed`，清空之前的回复 | `{ ok: false, error }`：不是雇主身份、不是自己企业的申请、时间看不懂、已经过去、一个时间都没有又没选电话再定 |
| `cancelMyApplicantInterview(applicationId)` | | `InterviewView`（`cancelled`） | 不是自己企业的申请时 `null` |

`getMyJobApplicants` 的每个申请人多了 `interview`（没有时 `null`）。

求职者：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `answerMyInterview(jobId, response)` | `{ kind: "confirm", slot }`（`slot` 必须是邀约里还没过去的时间；电话再定时不用）、`{ kind: "decline", reply? }`、`{ kind: "counter", reply }`（`reply` 必填） | `{ ok: true, interview }` | `{ ok: false, error }`：未登录或雇主身份、没有邀约、邀约已经不是 `proposed`、时间不在邀约里或已过去、没写方便的时间 |
| `myInterviewTodos()` | | 当前身份的面试待办：求职者「待确认的面试」，雇主「待确认的面试」和「X 回了方便的时间」；双方「今天 / 明天的面试」 | 未登录时 `[]` |

`myApplicationViews` 的每条多了 `interview`。求职者的申请结果通知（#105，ADR 0019，读取时生成）：被录用时 `hired:<申请编号>`「〈店名〉录用了你」；职位结束后其余申请人 `job-ended:<申请编号>`「〈职位〉已经招满 / 已结束」；都点开到 `/me/saved`。通知（`serverNotifications`）：求职者的编号是 `interview:<id>:<invitedAt>`，雇主的是 `interview-reply:<id>:<respondedAt>`，有新改动就是新编号。

## 职位提醒 — `src/app/[lang]/me/alerts/actions.ts`

职位提醒（#53，PRD R-29）按账号存在 `job_alerts` 表：名称、国家、筛选条件（`filterToQuery` 写出的查询串，读取时用 `parseFilter`，未知的值丢掉）、是否暂停。分区的提醒（#131，ADR 0020）`section` 是 `internship` 或 `professional`，筛选条件是分区的（`externalFilterToQuery`）；审核员通过外部职位（`approveExternalJob`）时 `matchExternalJobAlerts`（`src/db/external-job-alerts.ts`）匹配同一分区没暂停的提醒，命中写进 `external_job_alert_hits`，同样一个职位只提醒一次。两种合计每个账号最多 5 个。新职位直接发布（`publishJob`）或审核通过（`approveJob`）时，`matchJobAlerts`（`src/db/job-alerts.ts`）用职位列表同一个 `matchesFilter` 匹配所有没暂停的提醒，命中写进 `job_alert_hits`，账号 + 职位为主键，同一个职位对同一个人只提醒一次。邮件提醒等邮件服务（#16）。

`JobAlertView`：`{ id, name, query, section, href, conditions: string[], paused }`，`section` 职位列表的提醒为 `null`，`href` 是提醒对应的列表，`conditions` 是条件的中文说明（和职位列表的筛选标签一样）。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `myJobAlerts()` | | 当前账号的提醒，先建的在前 | 未登录时 `null` |
| `saveMyJobAlert(query, section?)` | 职位列表的查询串；带 `section`（`internship` / `professional`）时是这个分区的查询串 | `{ status: "created", alert }`；同样的条件已经存过时 `{ status: "exists", alert }`（不新建） | 未登录时 `null`；已有 5 个时 `{ status: "limit" }` |
| `changeMyJobAlert(id, { name?, paused? })` | 名称去掉多余空白后 1–20 字（空白名称不改）；`paused` 布尔值 | 改后的全部提醒 | 未登录时 `null`；不是自己的提醒时不改，照样返回自己的列表 |
| `deleteMyJobAlert(id)` | | 删后的全部提醒；已经提醒过的通知保留 | 同上 |
| `myAlertNotifications()` | | `{ scope, items }`：提醒找到的职位，按通知的形状（`id` 为 `alert:<职位编号>`，点开到 `/jobs/<编号>`；外部职位为 `alert:external:<编号>`，点开到 `/external/<编号>`），最新的在前，最多 50 条。雇主身份是本企业快截止的职位（#69）：截止前 3 天到截止后 14 天（还能续期时），`id` 为 `closing:<职位编号>:<截止时间>`，点开到 `/employer/jobs?tab=ending`；以及企业验证的结果（#78）：每份通过或驳回的申请一条，`id` 为 `verification:<申请编号>:<approved|rejected>`，驳回的写明理由和说明，点开到 `/employer/verify`。所有服务器通知都由 `serverNotifications()`（`src/app/[lang]/messages/server-notifications.ts`）生成，`markMyNotificationsRead` 也只接受它给出的编号（#94） | 未登录时 `null` |

## 只在开发环境存在的接口

`POST /api/dev/job-closing`（`src/app/api/dev/job-closing/route.ts`，#88）：把已登录雇主自己的一个职位的截止时间改到 `daysFromNow` 天后（负数是多少天前），用来在开发和浏览器测试里看「将截止」、续期和重新发布。生产环境返回 404。请求体 `{ jobId, daysFromNow }`（±365 天内）；成功 200，返回改后的职位；401 `{ error: "需要雇主身份" }`；400 `{ error: "找不到这个职位" }`（包括别家的职位）或 `{ error: "天数不对" }`。

`POST /api/dev/team-link-age`（`src/app/api/dev/team-link-age/route.ts`，#349）：把已登录雇主自己企业的一条邀请链接的生成时间往前挪 `days` 天，用来在浏览器测试里看过期的链接。生产环境返回 404。请求体 `{ token, days }`（1–365 的整数）；成功 200 `{ ok: true }`；401 `{ error: "需要雇主身份" }`；400 `{ error: "天数不对" }` 或 `{ error: "找不到这条链接" }`（包括别家的链接）。

`POST /api/dev/chat-reply`（`src/app/api/dev/chat-reply/route.ts`）：演示对话里的对方不是真实账号，开发和浏览器测试用它让对方「已读」或「回复」。生产环境返回 404。

| 请求体 | 成功 | 失败 |
| --- | --- | --- |
| `{ conversationId, reply?, readMine? }`：`reply` 最多 2000 字；`readMine: true` 把我发的消息标为对方已读 | 200，改动后的 `ChatRecord` | 401 `{ error: "请先登录" }`；400 `{ error: "没有这个对话" }` |

## 点击统计的事件 — `POST /api/events`（#312，ADR 0025）

浏览器的 `track(event)`（`src/lib/events/track.ts`）用 `navigator.sendBeacon` 发一条事件，不等回答。正文是 JSON：`{ name, path, jobId?, detail? }`。

- `name` 和 `detail` 只收 `src/lib/events/catalog.ts` 清单里的（ADR 0025 第 4 节）；跟职位有关的事件必须带 `jobId`，别的不能带。`path` 是路由模板（`/jobs/[id]`），不带查询串。
- 不管收没收下都回 204，不说原因。
- 访客、语言和身份由服务器从请求里取：`visitor` 是 `zg_visitor` 和新西兰日期的 HMAC（`ZG_EVENTS_SECRET`）；语言看 `zg_lang`；身份看会话（没登录是 `out`）。
- 不记：User-Agent 像爬虫的、带 `Next-Router-Prefetch` 或 `Purpose` / `Sec-Purpose: prefetch` 的、生产环境没设 `ZG_EVENTS_SECRET` 时的。同一访客同一天同一种事件最多 30 条。
- Server Functions 成功以后用 `recordRequestEvent(event)`（`src/lib/events/record.ts`）在服务器上记，规则一样；它从不抛错。
- 表 `events`（迁移 0026）只留 180 天：每天第一条写入时删掉更早的。

## 外部职位导入 — `npm run import:external`

#111（PRD R-39，ADR 0014）。没有 Server Function：本机命令（`src/db/cli.ts import:external`）读公司名单（`src/config/external-companies.ts`），对 `terms` 核对过且允许展示的公司请求它的公开接口，把事实存进 `external_jobs`（迁移 0016）。

- **我们请求的外部接口（只读，不要密钥）：**
  - Greenhouse Job Board API：`GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true&pay_transparency=true`
  - Lever Postings API：`GET https://api.lever.co/v0/postings/{site}?mode=json`
  - 每台主机先读 `/robots.txt` 并遵守；同一主机的请求间隔至少 2 秒（或主机的 `Crawl-delay`）；`User-Agent: zhaogong-external-jobs/1.0 (+https://github.com/open-alternative-app/zhaogong)`。
- **参数：** `npm run import:external -- [--dry-run] [公司 id …]`。不写公司就是整张名单；`--dry-run` 只打印每家会保留的事实，不写数据库（可以读还没核对条款的公司，用来在核对前看提取效果）。读不到的公司退出码 1。
- **数据函数（`src/db/external-jobs.ts`，只在服务器上用）：** `saveCompanyFeed(company, facts, now)` 存一次导入的结果（新职位待审；已有的更新事实和取到时间；接口里没有了或过了截止日的下架；已通过的职位名、链接或标记变了回到待审），`takeDownCompany(id)`，`listExternalJobs({ shownAt?, companyId? })`（带 `shownAt` 只返回那时可以显示的），`getExternalJob(id)`，`setExternalReview(id, review)`（审核后台的入口在 #112）。
- **能不能显示** 在读取时判断：`isShown()`（`src/lib/external-jobs/visibility.ts`）= 审核通过、没下架、2 天内刷新到过、截止日当天没过。`sectionOf(kind)`：实习和毕业生项目进「实习」，其余进「专业职位」。

## 审核后台「外部职位」— `src/app/[lang]/admin/external-actions.ts`

#112（PRD R-39，ADR 0014）。都只给审核员（`requireModerator`），每个操作写一条审核记录，`moderator` 是操作的审核员。

| 函数 | 作用 |
| --- | --- |
| `getExternalReview()` | `{ at, companies, pending, approved }`：待审（没下架的，带标记的在前）、已通过（`shown` 表示现在是否显示），以及名单上的公司和数据里出现的公司（条款核对情况、是否停用、待审和正在显示的数量）。 |
| `approveExternalJob(id, flagsChecked)` | 通过。带标记的职位 `flagsChecked` 要为 `true`；已下架的不能通过。 |
| `hideExternalJob(id, reason, note)` | 不显示（已通过的也可以撤下）。`reason` 是 `requirement` / `wrong_field` / `wrong_facts` / `other`，`other` 要写 `note`。 |
| `stopExternalCompany(companyId, note)` | 停用：记进 `external_company_blocks`（迁移 0018），这家所有职位立即下架，导入器不再请求它。 |
| `recordTakedownRequest(companyId, requester, note)` | 公司要求删除：记下谁提出（公司邮箱或部门）和内容，效果同停用。 |
| `resumeExternalCompany(companyId, note)` | 恢复导入：删掉停用记录，这家的职位回到待审，下一次导入重新读。 |

## 实习和专业职位的页面 — `src/app/[lang]/internships`、`src/app/[lang]/professional`、`src/app/[lang]/external/[id]`

#113（PRD R-39）。没有 Server Function：服务器组件直接读 `listExternalJobs({ shownAt })`（请求时间，`requestTime()`）和 `getExternalJob(id)`，只显示 `isShown()` 为真的职位。筛选参数（`src/lib/external-jobs/filter.ts`）：`field`（software / electrical）、`kind`（实习：internship / graduate；专业职位：full_time / part_time / contract / unstated）、`experience`（le2 / ge3 / unstated）、`visa`（sponsorship / required / unstated）、`city`、`paid=1`。职位页地址里的编号用 `encodeURIComponent`（编号含冒号）。

## 审核后台 — `src/app/[lang]/admin/actions.ts`

聊天风险（#384，ADR 0039）位于 `src/app/[lang]/admin/chat-risk-actions.ts`，三个函数都先 `requireModerator()`，拒绝时返回 `{ refused, error_zh }`（关闭时是 `AdminResult`）：`getChatRiskQueue()` 返回 `{ items }`，每项是一家企业：名字、碰到的几类、几条、最近一次、开项时间，不带消息；`getChatRiskMessages(employerId)` 返回这一项的消息 `{ messages }`（新的在前，最多 50 条：对话编号、消息编号、哪几类、文字、团队里谁发的、时间），交出之前按每段对话记一条查看记录（`chat`）；`closeChatRiskItem(employerId)` 关掉这一项、写一条操作记录（`chat_risk_close`），之后要再有 3 条才重新开。

审核员和雇主聊天（#407，ADR 0046）位于 `src/app/[lang]/admin/chat-actions.ts`，都先 `requireModerator()`：`getModeratorChats()` 返回 `{ chats }`，每段是 `{ employerId, employerName, openedAt, updatedAt, last?, unread }`（最新的在前，`unread` 是企业发的、审核员还没读的）；`startModeratorChat(employerId, from)` 开这家企业的对话或接着用已有的，`from` 是 `report`、`verification`、`temp_ban`，返回 `{ ok: true, employerId }`，企业不存在时 `{ ok: false, error_zh }`；`getModeratorChatThread(employerId, read = true)` 返回 `{ view }`（`ModeratorChatView`，`mine` 是审核员发的，`by` 是哪位审核员的邮箱或企业团队里的称呼），读了就算审核员都读了，没有对话时 `view` 是 `undefined`；`sendModeratorChatMessage(employerId, text)` 返回 `{ ok: true, employerId }` 或 `{ ok: false, error_zh }`。

门店照片（F8，ADR 0052）位于 `src/app/[lang]/admin/photo-actions.ts`，都先 `requireModerator()`：`getPhotoQueue()` 返回等审的照片 `{ id, employerId, employerName, uploadedAt }[]`（上传早的在前，拒绝时 `{ refused, error_zh }`），图本身经 `/api/company-photos/[id]` 给审核员看，不记查看记录（照片本来就要公开）；`approvePhoto(id)` 通过，显示到企业主页；`rejectPhoto(id, reason)` 带理由退回（`contact`、`faces`、`unrelated`、`unclear`、`inappropriate`），先记下决定再删文件，删不掉的下次清理时补删（每天一次的 `purgeExpiredPhotos`，或企业打开照片页时）。两个都返回 `AdminResult`，写一条操作记录（`photo_approve` / `photo_reject`，退回的带理由）；已经处理过或被删的照片返回「这张照片已经处理过或被删除了。」，没选理由返回「请选择退回理由。」。

举报证据读取位于 `src/app/[lang]/admin/evidence-actions.ts`：`getReportEvidence(reportId)` 先验证审核员身份，返回 `{ evidence }`（聊天按发送顺序，再列截图）；拒绝时返回 `{ refused, error_zh }`。交出聊天前记录审核员查看行为；截图经单独的受保护接口交出并记录。

只有环境变量 `ADMIN_ENABLED=1` 时可用（本机开发由 `.env.development` 打开，线上不设）；否则每个函数都抛出「审核后台未开放。」。打开时还要求已登录、并且是审核员（`requireModerator()`，`src/app/[lang]/admin/moderator.ts`，#50）：

- 未登录：`getModerationQueue()`、`getModerators()` 返回 `{ refused: "signed_out", error_zh: "请先登录。" }`，其他函数返回「请先登录。」。
- 已登录但不是审核员：返回 `{ refused: "not_moderator", error_zh: "只有审核员能使用审核后台。" }`，其他函数返回「只有审核员能使用审核后台。」。

第一位审核员用命令行 `npm run admin:grant <邮箱>` 添加（`admin:revoke` 移除），之后审核员在 /admin 的「审核员」一页里增删。开发环境的演示数据带一个演示审核员 `moderator@example.com`。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getModerationQueue()` | | `{ flagged, reported, log }`：待审核的职位、有未处理举报的职位（只含职位举报）、操作日志（每条带 `moderator`：操作的审核员邮箱；#60 之前的旧记录没有，删除账号后是 `deleted-account`） | `{ refused, error_zh }` |
| `approveJob(jobId)` | | `{ ok: true, text }`，职位上线 30 天，记日志 | `{ ok: false, error_zh }`：「这个职位不在待审核列表里。」「雇主已被封禁，不能通过。」「这个职位仍有不能发布的问题，只能下架。」 |
| `takeDownJob(jobId)` | | 下架，未处理的举报标为已处理，记日志 | 「找不到这个职位。」 |
| `dismissReports(jobId)` | | 驳回这个职位的举报，职位不变，记日志 | 「找不到这个职位。」「这个职位没有待处理的举报。」 |
| `banJobEmployer(jobId)` | | 封禁职位的雇主，下架其所有职位并关闭相关举报，记日志 | 「找不到这个雇主。」「这个雇主已经被封禁。」 |
| `getModerators()` | | `{ me, admin, admins, moderators: [{ email, grantedAt, grantedBy }] }`：`admin` 是问的人是不是管理员，`admins` 是配置里的管理员（ADR 0043），`moderators` 从早到晚、不重复列管理员；`grantedBy` 为 `null` 表示在服务器上添加（命令行或演示数据） | `{ refused, error_zh }` |
| `addModerator(email)` | 已经登录过、没有求职或招聘数据的账号的邮箱；**只有管理员** | `{ ok: true, text }`，并记进审核员变动记录 | 「只有管理员能添加、移除审核员。」「请输入正确的邮箱地址。」「这个邮箱还没有注册。请对方先用这个邮箱登录一次。」「这个邮箱已经有求职或招聘的数据。请用一个专门的审核员邮箱。」「这个账号已经是审核员。」 |
| `removeModerator(email)` | 审核员的邮箱；**只有管理员** | `{ ok: true, text }`，并记进审核员变动记录；审核员可以删到一个不剩 | 「只有管理员能添加、移除审核员。」「管理员在服务器配置里设定，不能在这里移除。」「这个账号不是审核员。」 |
| `getModeratorChanges()` | **只有管理员** | `{ changes: [{ id, at, action: "grant" \| "revoke", email, by }] }`，新的在前，最多 200 条；`by` 为 `null` 是命令行 | `{ refused: "not_admin", error_zh: "只有管理员能添加、移除审核员。" }`，或同上的 `refused` |

企业验证（#78，PRD R-16，ADR 0011）在 `src/app/[lang]/admin/verification-actions.ts`，同样先 `requireModerator()`：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getVerificationQueue()` | | 待审的申请，从早到晚：`{ request, employer, register, checklist }`。`register` 是这个 NZBN 在企业登记里的条目，`checklist` 是这份申请要核对的项目（申请认证雇主时多一项），每项带「去查」的链接。不含任何邮箱。返回之前给每份申请记一条查看记录（`recordViews`，类别 `verification`，见下面「查看记录」） | `{ refused, error_zh }` |
| `approveVerification(id, checklist)` | `checklist`：`{ [项目]: { done, note? } }` | `{ ok: true, text }`：企业得到申请的标识（认证雇主保持原级别），登记名和 NZBN 写进企业资料；核对结果存进申请；记日志 `verify_approve` | 「还有核对项没打勾：…。」「这份申请已经处理过，或者不存在。」「这家店已被封禁，不能通过验证。」 |
| `rejectVerification(id, reason, note, checklist)` | `reason`：`register_mismatch`、`phone_unreachable`、`impersonation`、`other`；`note`：说明，雇主会看到 | `{ ok: true, text }`：申请记为驳回，企业的标识不变；记日志 `verify_reject`（`note` 是理由和说明） | 「请选择驳回理由。」「请写明驳回的说明，雇主会看到。」「这份申请已经处理过，或者不存在。」 |

审核数据（#70，PRD R-34，ADR 0010）在 `src/app/[lang]/admin/stats-actions.ts`，同样先 `requireModerator()`：

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getModerationStats()` | | `{ at, pendingJobs, openReports, oldestPendingJobAt?, oldestOpenReportAt?, pendingVerifications, oldestPendingVerificationAt?, weeks, untimed }`（`pendingVerifications`：待审的企业验证，#78）。`at` 是服务器算的时间；`weeks` 是最近 8 周，本周在前，每周 `{ week（周一，YYYY-MM-DD，新西兰时间）, reported, handled, medianHandleMs（没有时为 null）, takenDown（含封禁一起下架的）, banned }`；`byModerator` 是同样 8 周里每位审核员的 `{ moderator?, approve, takeDown, dismiss, ban, verify, total }`（`verify`：通过或驳回的企业验证，#78），多的在前，#60 之前没记操作人的记录（`moderator` 为空）排最后；`untimed` 是迁移 0008 之前就处理完、没有处理时间的举报数；`aiPosting` 是 AI 发帖用量（#102）：`{ days, total }`，`days` 是最近 7 个新西兰日，今天在前，每天 `{ day, calls, tokens, failed, limited }`（`calls` 是调用模型的次数，含失败的；`tokens` 是输入、输出和缓存合计；`failed` 是出错、被拒或读不出答案的；`limited` 是被限额挡下、没有调用的），`total` 是 7 天合计（`day: "total"`），不含是谁调用的 | `{ refused, error_zh }` |

| `getFunnels(days)` | `days`：7 或 30，别的值按 7 | `FunnelReport`（`src/app/[lang]/admin/funnels.ts`，#316，ADR 0025 第 2、5 节）：`{ days, funnels, singles }`。`funnels` 是四条漏斗 `seek`、`external`、`post`、`signin`，每一步 `{ names, counts, rates }`：`names` 是算作这一步的事件；`counts` 按 `all`、`zh`、`en`、`out`、`seeker`、`employer` 分组，是走到这一步的「访客 + 新西兰日」数，1–4 写成 `"few"`（页面显示「少于 5」）；`rates` 是占第一步的整数百分比，第一步或任一方少于 5 时为 `null`。`singles` 是单独数的 `jobs_search`、`applicants_view`。只有计数离开服务器，不带访客 | `{ refused, error_zh }` |

举报关闭（下架、驳回、封禁）时 `updateReport` 写入 `handledAt`，重新打开时清空。

审核后台的「查看记录」（#336，ADR 0026）在 `src/app/[lang]/admin/views-actions.ts`，同样先 `requireModerator()`。审核后台把谁的个人信息交给审核员之前，先用 `recordViews(moderator, kind, ids)`（`src/db/personal-info-views.ts`）记一条：审核员、时间、类别（`verification` / `contact` / `profile` / `chat`，`src/lib/personal-info-views.ts`）、记录的编号，不记内容；同一位审核员 30 分钟内再看同一条只记一次。存在 `personal_info_views`（迁移 0027），留一年（`KEEP_DAYS`），每天第一条写入时删掉更早的。现在只有企业验证队列会交出个人信息；以后哪个函数要交出聊天、求职者资料或职位联系方式，也要先记。

| 函数 | 参数 | 成功 | 失败 |
| --- | --- | --- | --- |
| `getPersonalInfoViews(moderator, days)` | `moderator`：审核员邮箱，空或不在记录里就是全部；`days`：7、30 或 365，别的值按 7 | `{ days, moderator, views, more, moderators }`：`views` 新的在前，每条 `{ at, moderator, kind, subjectId }`，最多 200 条，`more` 表示还有更多；`moderators` 是有记录的审核员，给筛选用。读这份清单本身不记 | `{ refused, error_zh }` |

审核后台的入口（#73）：以前是 `canModerate()`，ADR 0043 起并进了会话：`accountStatus()` 等回答里的 `staff`（见上面「登录」一节）。

## 页面路由

| 路由 | 内容 | 需要 |
| --- | --- | --- |
| `/` | 介绍页 | — |
| `/jobs`、`/jobs/[id]` | 职位列表（筛选条件在查询参数里：`region`、`industry`、`role`（岗位类别编号，见 `docs/job-roles.md`，#96）、`type`、`minPay`、`visa`、`meals`、`housing`、`q`；职位提醒存的就是这串参数）、职位详情。职位卡和详情在企业下面显示老板活跃度：「今天在线」（新西兰时间）、「通常 1 小时内回复」或「通常当天内回复」，慢的、不在线的什么都不显示（#381，ADR 0038）；首页「精选职位」和企业主页的职位卡也一样 | — |
| `/employers/[id]` | 企业公开主页 | — |
| `/internships`、`/professional`、`/external/[id]` | 实习、专业职位两个分区和外部职位详情（见上面那一节，#113）；详情页不收录 | — |
| `/about`、`/privacy`、`/terms` | 关于找工（#324）、隐私说明和使用条款（#323）；三页都从页脚进 | — |
| `/safety` | 防骗指南：先交钱、花钱买签证或担保、刷单返利、要护照原件或银行卡密码、工资低于最低时薪（时薪从国家设置读，#390，ADR 0041） | — |
| `/me/reports` | 我的举报：这台设备发过的职位举报，处理中 / 已结束；聊天里的举报照列、没有状态（#390，ADR 0041）；不收录 | —（没登录时在这台设备发的也列） |
| `/login` | 注册或登录（`?role=employer` 开通雇主身份，`?next=` 回到原页面） | — |
| `/account`、`/workspace`、`/messages`、`/notifications`、`/profile`、`/me`、`/me/saved` | 我的、待办、聊天、通知、主页编辑、浏览与举报、收藏和进度 | 登录 |
| `/messages/resume/[id]` | 聊天里发的中英文简历，发出时的样子，只读、可打印，不收录（#379，ADR 0037）；`id` 是那条消息的编号 | 登录；只给发简历的求职者和收简历的企业团队，别人看到 404 |
| `/account/data` | 数据与账号：导出自己的数据、删除账号（#54，ADR 0009） | 登录 |
| `/me/alerts` | 职位提醒：查看、改名、暂停、删除（#53） | 登录，求职者身份 |
| `/profile/resume` | 中英文简历：预览、打印 / 存为 PDF、补填英文、签证、联系方式、分享链接（#86） | 登录，求职者身份 |
| `/resume/[id]` | 分享的简历，只读，不收录；关闭后显示「已关闭或不存在」（#86） | — |
| `/candidates/[id]` | 求职者主页（`?job=` 带上职位） | 雇主身份才显示职位和聊天入口 |
| `/employer` | 雇主介绍 | — |
| `/employer/post`、`/employer/jobs`、`/employer/jobs/[id]`、`/employer/candidates`、`/employer/verify` | 发布、职位管理（`?tab=ending` 等打开某个状态）、编辑职位、推荐人才、企业验证 | 雇主身份 |
| `/employer/jobs/[id]/republish` | 用截止超过 14 天的职位的内容发布一条新职位（#69） | 雇主身份 |
| `/employer/jobs/[id]/copy` | 复制为新职位：用在招或已结束职位的内容新建一条，同一个表单，走 `publishJob`（#190） | 雇主身份 |
| `/employer/team` | 团队：成员、我的称呼、邀请和没回复的邀请（#87）、邀请链接（#349） | 雇主身份 |
| `/employer/photos` | 门店照片和福利（ADR 0052）：上传、删除、看审核状态和退回理由，勾选福利；成员只能看 | 雇主身份 |
| `/employer/team/join/[token]` | 打开邀请链接：哪家店邀请；没登录时「登录后加入」，登录后填称呼加入为成员；不能用时说明原因（#349，ADR 0028）；不收录、不带 Referer | — |
| `/employer/jobs/[id]/applicants` | 聊过这个职位的人（ADR 0030）：申请过的带资料要点和附言；合适 / 不合适 / 已录用、聊天、约面试（#84） | 雇主身份 |
| `/employer/jobs/[id]/stats` | 职位数据：最近 14 天的浏览、聊天、查看联系方式，和从发布到现在的申请、面试、录用（`getMyJobDays`） | 雇主身份 |
| `/admin` | 审核后台 | `ADMIN_ENABLED=1`，审核员 |
| `POST /api/dev/chat-reply` | 演示对话的对方已读或回复（见上） | 只在开发环境；登录 |
| `POST /api/events` | 点击统计的一条事件（见上，#312） | — |
| `GET /api/push/worker` | root scope的push-only Service Worker：JavaScript MIME、no-store，不拦截fetch或缓存私密页 | — |
| `GET /api/push/open` | 系统提醒点击：只允许有权访问的对话；未登录去login并保留同源返回地址，身份不符去account提示，不自动换身份 | 当前会话和对话所有权 |
| `GET /api/company-photos/[id]` | 企业主页的一张门店照片（ADR 0052）：通过的、企业没被封禁的谁都能看，`public, max-age=600`；等审的只给本企业的人和审核员，`private, no-store`；其他（退回的、被封禁企业的、编号不对）一律 404。图片本身，类型是上传时按字节认的，`nosniff`、`sandbox` | — |
| `GET /api/report-evidence/[id]` | 职位举报附的一张截图（ADR 0027）：图片本身，`nosniff`、`sandbox`、不缓存；每次交出先记进查看记录（ADR 0026）。不是审核员、编号不是截图都回 404 | `ADMIN_ENABLED=1`，审核员 |
| `/manifest.webmanifest` | 可安装网页的清单 | — |
| `/sitemap.xml` | 首页、职位列表、实习和专业职位两个分区（#264）、关于 / 隐私 / 条款三页、在招职位（过了截止时间的不列，ADR 0008）、有在招职位且没被封禁的企业主页；外部职位详情不列；每次请求时生成（`sitemapEntries`，`src/lib/site.ts`） | — |
| `/robots.txt` | 允许收录，但不收录 `/admin`、`/account`、`/workspace`、`/profile`、`/me`、`/messages`、`/notifications`、`/login`、`/employer/`、`/candidates/`、`/resume/`、`/api/`；指向 sitemap | — |

职位详情页 `/jobs/[id]` 在职位在招时带一段 schema.org `JobPosting` 结构化数据（`<script type="application/ld+json">`）：职位名、描述、发布和截止时间、雇主和企业主页链接、地点、时薪、用工形式，**不含联系方式**（`src/lib/job-posting.ts`）。sitemap、robots 和结构化数据里的绝对地址用环境变量 `SITE_URL`，没设置时用请求的域名。
