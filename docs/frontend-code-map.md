# 前端代码阅读入口

先看页面组件，再按需要查看状态和数据规则。以下组件均沿用现有演示数据与本机存储。

## 工作台

入口是 `src/components/seeker/WorkHub.tsx`，只负责页面框架、登录提示及页面组合。

| 功能 | 主要文件 | 职责 |
| --- | --- | --- |
| 导航 | `WorkspaceNav.tsx` | 桌面侧栏、手机导航、身份文案及未读数 |
| 总览 | `WorkspaceDashboard.tsx` | 工作台摘要、最近聊天及快捷入口 |
| 聊天列表 | `MessageWorkspace.tsx` | 选择会话、草稿和可见时标记已读 |
| 聊天内容 | `ChatThread.tsx`、`MessageLog.tsx` | 联系人、消息输入、消息展示和滚动 |
| 通知 | `NotificationWorkspace.tsx` | 通知展示、跳转和标记已读 |
| 主页编辑 | `ProfileWorkspace.tsx`、`ProfileFields.tsx` | 资料编辑、预览、简历及私密资料 |

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

`npm run check` 检查格式、类型、lint、单元测试和构建。浏览器验收复用当前开发服务器：PowerShell 中设置 `$env:E2E_PORT='8701'`，然后运行 `npm run test:e2e`。
