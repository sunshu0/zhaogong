# 0025 点击统计：Clarity 看怎么用，自建漏斗看走到哪一步

- 状态：已采纳（导师 10-19 22:4x；补了未满 18 岁、机器人、HMAC、CSP 四处）
- 日期：2026-10-19。用户 10-19 22:1x 定了「Clarity 加自建漏斗：完全免费，关键数据留在自己库里」；导师先替用户定了几处稳妥做法（Progress「导师 10-19 22:1x」），用户可以改。

## 情况

1. **现在不知道用户在哪一步走掉。** 求职者看了职位有没有点「立即沟通」或「申请」，雇主开始发布以后有没有发出去，登录卡在填邮箱还是填验证码，都没有数据。唯一的统计是职位浏览和发起聊天的计数（`job_views`、`job_chat_starts`，#55），只给雇主看自己的职位。
2. **要两样东西。** 一是「人在页面上怎么用」：点了哪里、滚到哪里、哪里点了没反应。这类东西自己做不划算，用 Microsoft Clarity（免费，录屏和热图）。二是「每一步有多少人走到」：要准、要留在自己库里，自己记事件、自己出漏斗。
3. **限制。**
   - 找工的页面上有联系方式、简历、聊天、签证这些敏感内容（CLAUDE.md、ADR 0002），录屏绝不能带走这些。
   - 新西兰《2020 年隐私法》要求说清收集什么、为什么、怎么查阅和更正（PRD R-30）。隐私页还没写（「待用户」③）。
   - 首屏 JS 有预算（`docs/performance-budget.md`，#240 之后刚压下来）。
   - 生产环境还没部署（#15）；开发、测试构建、e2e 都不能有第三方脚本。
   - 已有一个匿名访客 cookie `zg_visitor`（`src/lib/visitor.ts`）：一年期、httpOnly，只在职位页发，库里只存它的 SHA-256（`job_views`）。

## 决定

### 1. 两件事分开

| | Clarity | 自建漏斗 |
| --- | --- | --- |
| 看什么 | 点击、滚动、热图、录屏（页面文字全部遮盖） | 每个流程每一步有多少访客走到 |
| 数据在哪 | 微软的 Azure（[数据说明](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data)） | 自己的数据库，新表 `events` |
| 要不要同意 | 要，同意前不加载 | 不要（匿名、只在本站用），隐私页写明 |
| 谁能看 | Clarity 项目里用户加进去的人 | 审核员，审核后台「审核数据」里的漏斗 |

### 2. 自建漏斗：要看的流程

每个流程按「访客 + 当天」串起来（见第 3 节），报表只出每一步的人数和转化率，不出单个访客的路径。

| 流程 | 步骤（事件） |
| --- | --- |
| 求职：找到职位 → 联系雇主 | `home_view` 或 `jobs_list_view` → `job_view` → `chat_start`（2026-10-20 用户定删掉「申请」以后，原来的 `apply_open`、`apply_submit` 停掉了） |
| 求职：外部职位 | `external_list_view` → `external_view` → `external_apply_click` |
| 雇主：发布 | `post_view` → `post_mode` → `post_preview` → `post_publish` |
| 登录 | `signin_view` → `signin_code_sent` → `signin_success` |

另外两个单独看的数：`jobs_search`（用了哪些筛选）、`applicants_view`（雇主看申请人）。

### 3. 每条事件存什么

新表 `events`（迁移号到时在 Progress 要）：

| 列 | 内容 | 例子 |
| --- | --- | --- |
| `name` | 事件名，只收下面清单里的 | `job_view` |
| `at` | 时间（ISO，到秒） | `2026-10-20T09:12:30Z` |
| `day` | 新西兰日期，报表按它分组 | `2026-10-20` |
| `visitor` | `HMAC-SHA256(ZG_EVENTS_SECRET, zg_visitor + day)`：同一天能串起来，跨天串不起来 | 64 位十六进制 |
| `path` | 路由模板，不带参数和查询串 | `/jobs/[id]` |
| `lang` | 页面语言 | `zh` / `en` |
| `role` | 当时的身份 | `out` / `seeker` / `employer` |
| `job_id` | 只在跟某个职位有关的事件上：职位或外部职位的编号（本来就是公开的） | `j3` |
| `detail` | 一个固定取值的小词，见清单；没有就空 | `paste` |

**不存：** 邮箱、账号、企业编号、IP、完整 User-Agent、网址查询串、搜索词和任何用户写的字（备注、聊天、描述）、简历和主页的内容、联系方式、屏幕内容。

**`zg_visitor`** 从「只在职位页发」改成「任何页面的 GET 都发」（`src/proxy.ts`），其余不变。

**`visitor` 列用 HMAC，不用直接哈希。** 密钥放在服务器的环境变量 `ZG_EVENTS_SECRET`，不进代码和数据库。日期也算进去，所以库里没法把一个人一年的行为连起来，漏斗只看同一天内的步骤。就算有人同时拿到数据库和某个人的 cookie，没有密钥也对不上。
- 开发、单测、测试构建没设密钥时，用代码里固定的测试值。
- 生产环境没设密钥就不记任何事件，服务器启动时打一行日志说明。

**保留 180 天。** 不跑定时任务（ADR 0008）：每天第一条写入时顺手删掉 180 天以前的行。报表只看最近 7 天和 30 天。

**删除账号**（ADR 0009）不用管这张表：里面没有邮箱和账号。`account-data.test.ts` 的「含 email 的列都要处理」检查不受影响。

### 4. 埋点清单

「服务器」表示在 Server Function 成功以后记（不怕广告拦截，也不会多记）；「浏览器」表示页面加载或按下时用 `navigator.sendBeacon` 发到新的 Route Handler（`POST /api/events`，只收清单里的名字和取值，每个访客每天每种事件有上限）。

**不记机器人和预取。** `/api/events` 和服务器端的记录遇到下面两种请求一律不记：
- User-Agent 明显是爬虫：含 `bot`、`crawler`、`spider`、`slurp`、`headless` 等。User-Agent 只拿来判断，不存。
- 预取请求：带 `Next-Router-Prefetch` 或 `Purpose: prefetch`（`Sec-Purpose: prefetch`）请求头。

| 事件 | 在哪里、什么时候 | 记在 | `job_id` | `detail` 的取值 | 谁埋 |
| --- | --- | --- | --- | --- | --- |
| `home_view` | 首页 `/` 显示 | 浏览器 | | | A |
| `jobs_list_view` | `/jobs` 显示 | 浏览器 | | `filtered` / `all` | A |
| `jobs_search` | 筛选表单提交（`FilterForm.tsx`） | 浏览器 | | 用了哪些筛选的名字，逗号分开：`q,region,industry,type,pay,meals,…`（只有名字，没有值和搜索词） | A |
| `job_view` | `/jobs/[id]` 显示 | 浏览器 | 有 | | A |
| `chat_start` | 职位页「立即沟通」拿到对话（`StartEmployerChat.tsx`，`openEmployerChat` 返回编号时） | 浏览器 | 有 | `signed_out`（没登录、先去登录）或空 | A |
| `external_list_view` | `/internships`、`/professional` 显示 | 浏览器 | | `internship` / `professional` | C |
| `external_view` | `/external/[id]` 显示 | 浏览器 | 有（外部职位编号） | | C |
| `external_apply_click` | 外部职位页按「去官网申请」 | 浏览器 | 有 | `demo`（演示职位）或空 | C |
| `signin_view` | `/login` 显示 | 浏览器 | | `seeker` / `employer`（网址里的 role） | C |
| `signin_code_sent` | `requestSignInCode` 成功（`login/actions.ts`） | 服务器 | | | C |
| `signin_success` | `signInAccount` 成功 | 服务器 | | `new`（新账号）/ `returning` | C |
| `post_view` | `/employer/post` 显示 | 浏览器 | | | B |
| `post_mode` | 选了发布方式（`post-flow-state.ts` 的 step 第一次变成 `chat` / `paste` / `form`） | 浏览器 | | `chat` / `paste` / `form` | B |
| `post_preview` | 走到核对那一步（step 变成 `preview`） | 浏览器 | | | B |
| `post_publish` | `publishJob` 成功（`employer/actions.ts`） | 服务器 | 有 | `live` / `pending_review` | B |
| `applicants_view` | `/employer/jobs/[id]/applicants` 显示 | 浏览器 | 有 | | B |

加事件要先改这张表（改 ADR），再改代码；名字和取值在代码里是一个常量表，`/api/events` 和单测都从它读。

### 5. 报表

审核后台「审核数据」加一块「漏斗」（B 做）：每个流程最近 7 天 / 30 天每一步的访客数和转化率，按语言、身份可以分开看。只有审核员能看（`requireModerator()`，ADR 0007）。不出单个访客的明细，人数少于 5 的格子显示「少于 5」。

### 6. Clarity

**加载条件（全部满足才加载）：**
- 生产构建，而且设了 `NEXT_PUBLIC_CLARITY_ID`。开发、测试构建（`ZG_E2E=1`）、e2e 一律不加载，代码里写死判断，有单测。
- 用户在同意提示里点了「同意」（第 7 节）。
- 当前页面不在下面的「不录」名单里。

**怎么加载：** 首屏之后（`load` 事件以后）插入官方的跟踪代码（[安装说明](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup)），数据发到 `https://www.clarity.ms/collect`。不用 npm 包 `@microsoft/clarity`，这样它不进我们的 JS 包。加载后立刻调用 [Consent API v2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)：`window.clarity('consentv2', { ad_Storage: "denied", analytics_Storage: "granted" })`，广告一项永远是 denied。

**项目设置（用户在 Clarity 后台设，上线前核对）：**
- **Masking mode 设成 Strict**（[遮盖说明](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking)）：页面上的文字全部遮盖；输入框和下拉框在任何模式下都遮盖。遮盖在浏览器里完成，被遮的内容不会上传。
- **Settings > Setup > Cookies 关掉**（[Cookie 同意](https://learn.microsoft.com/en-us/clarity/setup-and-installation/cookie-consent)）：只有收到同意信号才设 cookie。我们本来就是同意后才加载，这是第二道保险。
- 不用 `identify`，不发任何账号、邮箱、企业名。自定义标签（[客户端 API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api)）只发 `lang` 和 `role` 两个固定取值。微软的文档没有禁止往标签里放个人信息，这是我们自己的规矩。
- 代码里永远不写 `data-clarity-unmask`：它会盖过 Strict（遮盖说明里写明了两个属性都优先于后台设置）。

**不录的页面。** 官方的说法是：不想录的页面就别放跟踪代码，没有按网址排除的设置（[FAQ](https://learn.microsoft.com/en-us/clarity/faq)）。所以分两层：
1. 直接打开下面这些页面时不加载 Clarity。
2. 站内是客户端跳转，Clarity 一旦加载就不会自己卸掉。所以这些页面的布局最外层再套 `data-clarity-mask="true"`，整页遮住。

名单：`/login`、`/account`、`/account/data`、`/messages`、`/notifications`、`/workspace`、`/profile`、`/profile/resume`、`/resume/[id]`、`/candidates/[id]`、`/me` 及其下面、`/admin`、`/employer/verify`、`/employer/team`、`/employer/jobs/[id]/applicants`。职位页上的联系方式块（`ContactReveal.tsx`）和申请表（`ApplyJob.tsx`）也套 `data-clarity-mask="true"`。

**实习分区也不录（未满 18 岁，见「后果」的风险和「待用户」①）：** `/internships`，以及属于实习分区的外部职位页（`sectionOf(kind)` 是 `internship` 的 `/external/[id]`），做法跟上面一样分两层。这些页面的自建事件照记。用户 10-20 确认：实习分区不开 Clarity。

**数据留多久、谁能看**（微软的规定，[FAQ](https://learn.microsoft.com/en-us/clarity/faq)、[团队管理](https://learn.microsoft.com/en-us/clarity/setup-and-installation/team-management)）：
- 录屏 30 天；收藏的录屏和随机抽样的录屏、热图最多 9 个月。
- 删除某一个人的数据只能删整个项目，所以我们不发任何能认出人的东西。
- 角色只有 Admin 和 Team member。Admin 是用户本人，其他人由用户用邮件邀请。分享给访客的链接会按设定的天数过期；我们不用访客链接。
- Clarity 按 IP 判断大致位置；微软没写是否存完整 IP（[数据说明](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data)），隐私页照这个写。

### 7. 同意提示

- 第一次打开任何一页时，页面底部出现一条提示（不是弹窗，不挡内容，手机上在底部导航上面）。两个同样大小的按钮。
- 选择存在 cookie `zg_consent`（`clarity` 或 `none`，一年，`SameSite=Lax`，浏览器能读）。不选就当没同意，提示下次再出现，最多出现 3 次，之后不再出现、也不加载。
- 页脚和「我的」里有「统计设置」，可以随时改。改成不同意时调用 `window.clarity('consent', false)` 清掉 Clarity 的 cookie（官方说这个旧接口以后会弃用，到时换成 v2 的 denied），然后整页刷新，脚本就不在了。
- 不同意不影响任何功能。

文字（放进 ui 字典，A 的文件，到时在 Progress 说一声）：

| | 中文 | English |
| --- | --- | --- |
| 正文 | 我们想用 Microsoft Clarity 记录页面上的点击和滚动，用来改进找工。页面文字和你输入的内容都会遮盖，不录聊天、简历和联系方式。同意后才开启，不同意也能照常使用。 | We'd like to use Microsoft Clarity to record clicks and scrolling on our pages, to make 找工 better. All text on the page and anything you type is masked, and chats, CVs and contact details are never recorded. It only starts if you agree, and the site works the same if you don't. |
| 按钮 | 同意 / 不用了 | Agree / No thanks |
| 链接 | 隐私说明 | Privacy |
| 设置入口 | 统计设置 | Analytics settings |

### 8. 跟首屏预算的关系

- Clarity 的脚本从 clarity.ms 来，同意后、`load` 以后才插入，不在我们的 JS 包里，不算进首屏预算。
- 同意提示和 `track()` 在共用布局里，会进每一页的首屏 JS（估计 1–2 KB）。照常算进预算，PR 里写明涨了多少。
- 事件用 `sendBeacon`，不等回答，不影响页面。

### 9. 隐私页要写的（上线前，「待用户」③）

Clarity 在生产环境打开之前，隐私页必须已经写好、能打开，至少包括：

- **Clarity：** 用来做什么；同意后才开启、怎么撤回；收集什么（点击、滚动、遮盖后的页面结构、设备和浏览器、按 IP 得出的大致位置）。
- **Clarity 的 cookie 和存储：** 第一方 `_clck`、`_clsk`，以及微软的第三方 cookie（[Cookie 列表](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-cookies)）；数据由微软处理、存在 Azure；保留期照第 6 节。
- **自建事件：** 存什么、不存什么（第 3 节），不跟账号挂钩，保留 180 天，只在找工内部看。
- **`zg_visitor` 和 `zg_consent`** 两个 cookie 各是做什么的。
- 查阅、更正和联系方式（隐私法）。

## 故意不做的

- 不用 Google Analytics、Meta 像素或任何广告和再营销工具；`ad_Storage` 永远是 denied。
- 不在同意前加载 Clarity，也不用它的「无同意模式」。
- 不把事件或录屏跟账号、邮箱、企业连起来；不用 Clarity 的 `identify`。
- 不录聊天、简历、主页编辑、联系方式、登录、审核后台和「我的」那些页面。
- 不存搜索词、备注和任何用户写的字；不存 IP 和完整 User-Agent。
- 不出单个访客的路径，不拿统计去判断某个人（审核、封禁都不看它）。
- 不做 A/B 测试，不按统计给不同的人看不同的页面。
- 开发、测试构建和 e2e 里不加载任何第三方统计脚本。

## 后果

- 能看到三个主要流程每一步的人数，数据在自己库里。看「为什么走掉」时再去 Clarity 看遮盖后的录屏。
- 新增：`events` 表和迁移、`/api/events`、`track()`、同意提示、Clarity 加载器、`zg_visitor` 改成全站发、环境变量 `ZG_EVENTS_SECRET` 和 `NEXT_PUBLIC_CLARITY_ID`。
- 现在站里没有 Content-Security-Policy。以后加的话，`script-src` 和 `connect-src` 要放行 `clarity.ms`（跟踪代码从那里来，数据发到 `www.clarity.ms/collect`）。
- **要拆的 Issue（ADR 采纳后）：**
  - C：Clarity 加载器和同意提示（共用布局）、`events` 表和 `/api/events`、登录和外部职位的事件。
  - A：求职端的事件。
  - B：发布和申请人的事件，审核后台的漏斗报表。
- **风险：**
  - **未满 18 岁：** Clarity 的客户端 API 页写着不该用在面向未满 18 岁用户的网站上（[客户端 API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api)）。找工面向成人，但实习分区可能有学生来。导师先定了稳妥做法：实习分区和属于它的外部职位页不加载 Clarity（第 6 节）。
  - **Cookie 有效期：** 微软没写 Clarity 各个 cookie 的有效期，隐私页只能写名字和用途。
  - **欧盟、英国、瑞士：** 微软从 2025-10-31 起对来自欧洲经济区、英国和瑞士的访问强制要求同意信号。我们一律先同意再加载、并发 v2 信号，不受影响。
- **待用户：**
  - ① ~~实习分区要不要录 Clarity~~：用户 10-20 确认不开，结了。
  - ② 隐私页的写法。
  - ③ Clarity 项目由用户自己注册，把项目 ID 交给部署配置。

## 不选的做法

- **只用 Clarity。** 它的漏斗和自定义事件在微软那边，数据不在自己库里，而且只有同意的人才有数据，漏斗会偏。
- **只用自建。** 看不到「点了哪里、哪里点了没反应」，自己做录屏不划算，还要自己处理遮盖。
- **Clarity 先在无同意模式下跑，同意后再升级。** 无同意模式不设 cookie，但还是会上传数据（[Consent API v2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)）。我们宁可同意前什么都不发。
- **事件跟账号挂钩，看每个人的路径。** 统计用不着，还会变成要随账号导出和删除的个人数据。
- **用 npm 包 `@microsoft/clarity`。** 会进我们的 JS 包和首屏预算；官方的跟踪代码在同意后再插入就够了。
