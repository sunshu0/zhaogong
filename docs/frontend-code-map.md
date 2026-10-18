# 前端代码阅读入口

先看页面组件，再按需要查看状态和数据规则。以下组件均沿用现有演示数据与本机存储。

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

## 中英切换（第 20 轮，ADR 0023）

页面都在 `src/app/[lang]/` 下（根布局 `src/app/[lang]/layout.tsx`：`generateStaticParams` 列出 zh、en，`<html lang>`、`LangProvider`、按语言的标题和页脚；不存在的地址走 `[lang]/[...missing]`）。不分语言、留在 `src/app/` 根下的：`api/`、`robots.ts`、`sitemap.ts`、`globals.css`、`global-error.tsx`（中英都写）。`src/proxy.ts` 按 cookie `zg_lang` 改写到哪一份。

- `src/i18n/lang.ts`：`Lang`、`langFrom`、`localeTag`、`langRoute`（proxy 的判断）、`sitePath`、`contentLang`（用户写的中文标 `lang="zh-CN"`）。
- `src/i18n/messages.ts` 的 `Dictionary` / `pick`；字典在 `src/i18n/messages/<模块>.ts`（A：`seeker-*`、`ui`；B：`employer-*`、`chat`、`compliance`、`candidate-matching`；C：`login`、`account`、`notifications`、`admin*`、`external`）。
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

发帖表单状态仍在 `use-draft-form.ts`，表单与职位转换在 `post-form.ts`。对话生成规则在 `src/lib/ai-post/`，发布前检查在 `src/lib/compliance/`，演示数据操作通过 `src/app/[lang]/employer/actions.ts` 调用。

## 验证

`npm run check` 检查格式、类型、lint、单元测试和构建。浏览器验收跑在测试构建上（#139）：`npm run e2e:build`，`npm run e2e:start -- 8701`，再在 Git Bash 里 `E2E_SERVER=start E2E_PORT=8701 npx playwright test --workers=1`，跑完关掉服务器。不要用 `next dev` 跑 e2e。
