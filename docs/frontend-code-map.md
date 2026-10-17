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

## 雇主发帖与管理

这些文件位于 `src/components/employer/`：

| 功能 | 入口 | 配套文件 |
| --- | --- | --- |
| 招聘发布 | `PostFlow.tsx` | `post-flow-state.ts` 管理状态和动作；`PostFlowSteps.tsx` 展示各步骤；`PostFlowBars.tsx` 展示操作栏；`Published.tsx` 展示发布结果 |
| 招聘表单 | `DraftForm.tsx` | `DraftFormSections.tsx` 展示要求、描述和联系方式；`DraftFormParts.tsx` 提供字段、提示和输入控件 |
| 职位管理 | `ManageJobs.tsx` | `ManagedJob.tsx` 展示单条职位；`ManagedJobActions.tsx` 展示刷新、结束招聘等操作 |

发帖表单状态仍在 `use-draft-form.ts`，表单与职位转换在 `post-form.ts`。对话生成规则在 `src/lib/ai-post/`，发布前检查在 `src/lib/compliance/`，演示数据操作通过 `src/app/employer/actions.ts` 调用。

## 验证

`npm run check` 检查格式、类型、lint、单元测试和构建。浏览器验收跑在测试构建上（#139）：`npm run e2e:build`，`npm run e2e:start -- 8701`，再在 Git Bash 里 `E2E_SERVER=start E2E_PORT=8701 npx playwright test --workers=1`，跑完关掉服务器。不要用 `next dev` 跑 e2e。
