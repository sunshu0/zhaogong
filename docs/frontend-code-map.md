# 前端代码阅读入口

先看页面组件，再按需要查看状态和数据规则。数据在服务器的数据库里，经 Server Functions 读写，浏览器只做缓存和还没送到的改动（见 `docs/architecture.md` 的「数据放在哪里」）。

## 工作台

入口是 `src/components/seeker/WorkHub.tsx`，只负责页面框架、登录提示及页面组合。全站导航（手机底部导航、桌面顶栏）在 `src/components/ui/`：`BottomNav.tsx`、`HeaderNav.tsx`，规则在 `nav.ts`；「我的」页面是 `src/components/account/AccountHome.tsx`。

| 功能 | 主要文件 | 职责 |
| --- | --- | --- |
| 工作台侧栏 | `WorkspaceNav.tsx` | 桌面侧栏（总览、通知、主页、浏览与举报 / 推荐人才）；手机上这些入口在「我的」 |
| 总览（待办） | `WorkspaceDashboard.tsx` | 只列要处理的事；排序规则在 `src/components/account/todos.ts`，资料完成度在 `profile-checklist.ts` |
| 聊天列表 | `MessageWorkspace.tsx` | 选择会话、草稿和可见时标记已读 |
| 聊天内容 | `ChatThread.tsx`、`MessageLog.tsx` | 联系人、消息输入、消息展示和滚动 |
| 通知 | `NotificationWorkspace.tsx` | 通知展示、跳转和标记已读 |
| 主页编辑 | `ProfileWorkspace.tsx`、`ProfileFields.tsx`、`ResumeEditor.tsx` | 「别人看到的样子」、资料完成度、必填和选填、私密资料；边改边自动保存 |
| 求职者主页 | `CandidatePublicPage.tsx` | 雇主看到的求职者主页；顶部职位和聊天入口由 `src/components/account/candidate-context.ts` 决定 |

这些文件位于 `src/components/seeker/`。`ChatInteractions.tsx` 保留原有导出入口，具体实现分为 `ChatExchanges.tsx`（工具与请求列表）、`ExchangeAction.tsx`（交换确认）、`ChatReportButton.tsx`（举报），共用 `ChatDialog.tsx`。

聊天状态与动作仍集中在 `chat-client.ts`，资料和通知在 `hub-client.ts`。身份隔离由 `identity-scope.ts` 负责；双方交换规则在 `src/lib/chat-consent.ts`，阅读与回复计数规则在 `src/lib/chat-activity.ts`。

## 中英切换（第 20 轮和 #240，ADR 0023）

页面都在 `src/app/[lang]/` 下（根布局 `src/app/[lang]/layout.tsx`：`generateStaticParams` 列出 zh、en，`<html lang>`、`LangProvider`、按语言的标题和页脚；不存在的地址走 `[lang]/[...missing]`）。不分语言、留在 `src/app/` 根下的：`api/`、`robots.ts`、`sitemap.ts`、`globals.css`、`global-error.tsx`（中英都写）。`src/proxy.ts` 按 cookie `zg_lang` 改写到哪一份。

- `src/i18n/lang.ts`：`Lang`、`langFrom`、`localeTag`、`langRoute`（proxy 的判断）、`sitePath`、`contentLang`（用户写的中文标 `lang="zh-CN"`）。
- 字典的类型和 `pick()` 在 `src/i18n/messages.ts`，开头的注释有完整的例子。每个模块的字典分两个文件（#240）：
  - **中文：** `src/i18n/messages/<模块>.ts`，导出 `{ key, zh }`。
  - **英文：** `src/i18n/messages/en/<模块>.ts`，类型是 `Messages<(typeof xMessages)["zh"]>`。英文少键、多键、函数参数和中文对不上，`tsc` 都会报错。
  - 英文要在 `en/index.ts` 里按同一个 `key` 登记。
  - 两个文件归同一条线（A：`seeker-*`、`ui`；B：`employer-*`、`chat`、`compliance`、`candidate-matching`；C：`login`、`account`、`notifications`、`admin*`、`external`）。
  - **加一句话：** 中文文件和 `en/` 里的同名文件各加一行。
- **字典按语言挑：** 服务器上 `messages()`、`pick()` 只取当前语言那一份，所以服务器组件的 HTML 和 RSC 数据里只有一种语言。
  - **服务器上：** `src/i18n/english.ts` 加载模块时就用 top-level await 把全部英文读进来。
  - **浏览器里：** 中文那一份跟着组件进 JS。英文是单独的一块，只在英文页面加载：`LangProvider` 先 `use(loadEnglish())`，再渲染子组件。
  - 所以除了 `english.ts`，别的文件不要直接 import `messages/en/` 下的文件，不然英文会进中文页面的 JS。
- `Dictionary` 只允许 `{ key, zh }`（#251 之后）：把英文写进中文文件，`tsc` 就会报错。当初搬英文用的脚本 `scripts/i18n-split-en.mjs` 还在仓库里。
- 服务器端 `src/i18n/server.ts`（`messages()`、`serverLang()` 读根参数，`requestLang()` 读 cookie）；客户端 `src/i18n/client.tsx`（`LangProvider`、`useLang()`、`useMessages()`、`useSitePathname()`——看路径一律用它，服务器上的路径带 `/zh`，浏览器里没有）。
- `src/i18n/format.ts`：日期、时间、数字、金额。切换按钮 `src/components/ui/LangSwitch.tsx`，Server Function `src/i18n/actions.ts`，cookie 设置 `src/i18n/cookie.ts`，账号语言 `src/db/account-lang.ts`。
- 单测里 `next/root-params` 指到 `src/i18n/testing/root-params.ts`（`vitest.config.mts`）；英文页面的 e2e 检查 `e2e/helpers/english.ts`。

## 共用组件和页面外观（Round 19）

做法见 ADR 0021 和 `docs/design-system.md` 的 Round 19 一节。共用组件在 `src/components/ui/`，只由 A 线改：

| 功能 | 主要文件 | 职责 |
| --- | --- | --- |
| 卡片 | `Card.tsx` | `cardClass()`、`Card`、`CardLink`；整张卡一个链接时用 `linkCardClass()`，卡里的按钮加 `relative z-10`；列表行 `rowClass()` |
| 按钮 | `Button.tsx` | `Button`、`ButtonLink`、`buttonClass()`：按下有反馈，`loading` 转圈，`danger` / `danger-secondary`，`pill`，默认 12 px 圆角 |
| 下拉 | `Select.tsx`、`select-keys.ts` | 手机底部弹层、768 px 起下拉，键盘操作；JavaScript 之前是原生下拉框 |
| 弹层 | `BottomSheet.tsx`、`sheet-drag.ts` | 手机从底部滑上来（可以下拉关闭），768 px 起是居中面板；`footer` 放在滚动区外面 |
| 选择框 | `Checkbox.tsx` | `Checkbox`、`Radio` |
| 骨架屏 | `Skeleton.tsx` | `Skeleton`、`SkeletonList`、`ListPageSkeleton`、`DetailPageSkeleton`，各路由的 `loading.tsx` 用它们 |
| 轻提示 | `Toast.tsx`、`toast-queue.ts` | `toast()` 和全站一个 `Toaster` |
| 区块和列表 | `Section.tsx`、`LinkList.tsx` | `Section look="app"` 是卡片；`LinkList` 一行一个去处，按下变暗 |
| 标签 | `Tag.tsx`、`tag-kind.ts` | `Tag`，浅底的 `SoftTag` |
| 输入框 | `input-class.ts` | `inputClass()`、`fieldBorder()` |
| 顶栏和底部导航 | `StickyHeader.tsx`、`HeaderNav.tsx`、`BottomNav.tsx` | 吸顶、半透明；当前项图标变实心 |

求职者这边（`src/components/seeker/`）：职位卡 `JobCard.tsx`（`look="app"` 是 Round 19 的卡，`action` 放卡片底部那一行的额外按钮，要点、状态、标签在 `job-card-parts.ts`）；「我的」几页的框架 `WorkHub.tsx` 的 `WorkHubFrame look="app"`；找不到和出错的卡 `StatusCard.tsx`（`src/app/[lang]/not-found.tsx`、`error.tsx`、`global-error.tsx` 用它）。雇主后台补充的样式在 `src/components/employer/app-style.ts`。

## 雇主发帖与管理

这些文件位于 `src/components/employer/`：

| 功能 | 入口 | 配套文件 |
| --- | --- | --- |
| 招聘发布 | `PostFlow.tsx` | `post-flow-state.ts` 管理状态和动作；`PostFlowSteps.tsx` 展示各步骤；`PostFlowBars.tsx` 展示操作栏；`Published.tsx` 展示发布结果 |
| 招聘表单 | `DraftForm.tsx` | `DraftFormSections.tsx` 展示要求、描述和联系方式；`DraftFormParts.tsx` 提供字段、提示和输入控件 |
| 职位管理 | `ManageJobs.tsx` | `ManagedJob.tsx` 展示单条职位；`ManagedJobActions.tsx` 展示刷新、结束招聘等操作 |
| 团队 | `TeamPage.tsx` | 规则在 `team.ts`（ADR 0012）；管理员的邀请链接 `TeamLinks.tsx`；打开链接的页面 `src/app/[lang]/employer/team/join/[token]/page.tsx` 和它的表单 `TeamJoin.tsx`（#349，ADR 0028）；「我的」里收到的邀请 `TeamInvites.tsx` |

发帖表单状态仍在 `use-draft-form.ts`，表单与职位转换在 `post-form.ts`。对话生成规则在 `src/lib/ai-post/`，发布前检查在 `src/lib/compliance/`，演示数据操作通过 `src/app/[lang]/employer/actions.ts` 调用。

## 登录和「我的」

| 功能 | 主要文件 | 职责 |
| --- | --- | --- |
| 登录 | `src/app/[lang]/login/page.tsx`、`src/components/seeker/LoginForm.tsx` | 邮箱验证码，注册和登录是同一步；Server Functions 在 `login/actions.ts`（ADR 0007） |
| 「我的」 | `src/components/account/AccountHome.tsx` | 两种身份共用的入口页；待办 `todos.ts`、资料完成度 `profile-checklist.ts` |
| 切换身份 | `src/components/account/identity-switch.ts` | 账号菜单和「我的」里切换求职者 / 雇主，都落到工作台；`RedirectEmployer.tsx` 把雇主身份从求职者的页面送走 |
| 数据与账号 | `src/app/[lang]/account/data/page.tsx`、`src/components/account/MyDataPanel.tsx` | 下载全部数据、删除账号（ADR 0009）；只在浏览器的那部分在 `my-data.ts` |
| 审核后台入口 | `src/components/account/moderator-entry.ts` | 账号是审核员时，账号菜单和「我的」里才出现入口（`admin/entry-actions.ts`） |

通知页在上面「工作台」的表里（`NotificationWorkspace.tsx`）。

## 审核后台

只有 `ADMIN_ENABLED=1` 时打开（`src/app/[lang]/admin/enabled.ts`），每个 Server Function 先 `requireModerator()`（`admin/moderator.ts`）。页面 `admin/page.tsx` 只放 `ModerationQueue`，各标签页在 `src/app/[lang]/admin/_components/`：

| 标签页 | 组件 | Server Functions |
| --- | --- | --- |
| 发布时被标记、被举报、处理记录 | `ModerationQueue.tsx`（也负责标签页本身） | `admin/actions.ts`；分组和处理记录的说法在 `moderation.ts` |
| 企业验证 | `VerificationQueue.tsx` | `verification-actions.ts`（ADR 0011） |
| 外部职位 | `ExternalReview.tsx` | `external-actions.ts`（ADR 0014，见下一节） |
| 审核数据 | `ModerationStats.tsx` | `stats-actions.ts`，数字在 `moderation-stats.ts` 算（ADR 0010） |
| 审核员 | `ModeratorList.tsx` | `admin/actions.ts` 的 `getModerators` 等 |

读取用 `use-admin-load.ts`（规则在 `admin/load-state.ts`），没回答时在原处显示 `Failed.tsx` 的「没取到」和「重试」，操作没回答时卡片里显示「没成功，请重试」（ADR 0024）。`Cancel.tsx`、`Empty.tsx` 是确认步骤的「取消」和空列表的一行字。

## 实习和专业职位（外部职位）

外部职位怎么导入、审核、什么时候显示，见 `docs/architecture.md` 的「外部职位」。页面这边：

| 功能 | 主要文件 | 职责 |
| --- | --- | --- |
| 两个分区 | `src/app/[lang]/internships/page.tsx`、`professional/page.tsx` → `src/components/external/ExternalSectionPage.tsx` | 已通过的外部职位列表和筛选；筛选规则在 `src/lib/external-jobs/filter.ts` |
| 职位页 | `src/app/[lang]/external/[id]/page.tsx` | 事实、来源和取到的日期、「去官网申请」；不收录。演示职位的「去官网申请」是 `DemoApply.tsx`，页底「公司要求删除」是 `TakedownNote.tsx` |
| 说法 | `src/lib/external-jobs/labels.ts` | 事实的中英说法，审核后台和分区页共用；原文没写的一律「原文未说明」 |
| 收藏和提醒 | `src/components/seeker/SaveJobButton.tsx`（键用 `saved-jobs.ts` 的 `externalSaveKey`）、`src/lib/external-jobs/alerts.ts` | 外部职位也能收藏、在分区上订提醒（ADR 0020） |

## 读取失败和断网（ADR 0024）

Server Function 没回答时的做法见 [ADR 0024](adr/0024-no-answer-from-the-server.md)。共用部件在 `src/components/ui/`：`useServerLoad`（`use-server-load.ts`，状态规则 `shownLoad` 在 `server-load.ts`）、`LoadFailed.tsx`，文字在 ui 字典的 `load`；求职端已有出错文字的地方用 `src/components/seeker/RetryLine.tsx`。审核后台用自己的 `src/app/[lang]/admin/load-state.ts`。断网的 e2e：`e2e/employer/errors.spec.ts`、`e2e/seeker-errors.spec.ts`、`e2e/admin-errors.spec.ts`。

## 验证

`npm run check` 检查格式、类型、lint、单元测试和构建。浏览器验收跑在测试构建上（#139）：`npm run e2e:build`，`npm run e2e:start -- 8701`，再在 Git Bash 里 `E2E_SERVER=start E2E_PORT=8701 npx playwright test --workers=1`，跑完关掉服务器。不要用 `next dev` 跑 e2e。
