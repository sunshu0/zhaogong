# 架构

> 描述 2026-10-15 的代码：前端完整，数据在服务器进程内存和浏览器本机。阶段三接入数据库和真实登录后更新本文件。决定记录在 `docs/adr/`，页面和组件的阅读入口在 `docs/frontend-code-map.md`。

## 一句话

Next.js 16（App Router，React 19，Cache Components）单仓库应用。页面在服务器渲染，所有服务器数据都经过 `src/lib/data.ts`；写操作走 Server Functions（`"use server"` 的 `actions.ts`）；只属于一个用户的东西（会话、聊天、主页资料、通知已读、浏览和举报记录）目前存在浏览器 `localStorage`。部署目标是 Cloudflare Workers（OpenNext）。

## 目录

| 位置 | 内容 | 规则 |
| --- | --- | --- |
| `src/app/` | 路由。`page.tsx` 是服务器组件，只取数据、拼页面 | 每个可写的区域旁边有一个 `actions.ts` |
| `src/components/seeker/` | 求职端页面组件，以及两种身份共用的聊天、通知、主页 | 历史原因放在 seeker 下，阶段二按功能整理 |
| `src/components/employer/` | 雇主发帖、职位管理、推荐人才、企业验证 | |
| `src/components/account/` | 「我的」、待办、资料完成度、候选人条件这类跨身份的逻辑 | 纯函数都有单测 |
| `src/components/ui/` | 共用组件和导航：`Button`、`Tag`、`Pay`、`Section`、`MoreMenu`、`VerificationBadge`、`BottomNav` | 视觉规则见 `docs/design-system.md`，设计稿在 `docs/design/` |
| `src/lib/` | 领域逻辑：合规检查 `compliance/`、AI 发帖 `ai-post/`、交换规则 `chat-consent.ts`、候选人匹配、数据访问 `data.ts`、类型 `types.ts` | 不依赖 React |
| `src/config/`、`src/i18n/` | 国家配置（地区、最低工资）、中文名称表 | |
| `src/mock/` | 演示数据 | 只由 `data.ts` 读取 |
| `e2e/` | Playwright 浏览器测试（手机 375 和桌面 1280 两个项目） | |

## 数据放在哪里

**服务器（`src/lib/data.ts`）：** 职位、企业、账号与企业绑定、举报、审核日志、联系方式查看记录。现在是进程内存里的数组，启动时从 `src/mock` 复制；服务器重启就回到演示数据。函数都是 `async`，签名按数据库的样子设计，阶段三只换函数体（ADR 0001）。

**浏览器（`createLocalStore`，`src/components/seeker/local-store.ts`）：**

| 键 | 内容 |
| --- | --- |
| `zhaogong:session` | 演示会话：邮箱、当前身份、绑定的企业 |
| `zhaogong:chat-demo` | 每个身份的聊天、已读、交换请求、聊天举报（只存用户自己产生的部分，演示对话读取时合并） |
| `zhaogong:profiles-by-identity` | 每个身份的主页资料改动 |
| `zhaogong:notifications-by-identity` | 通知已读 |
| `zhaogong:viewed-jobs`、`zhaogong:reports-sent` | 浏览和举报记录 |

这些数据带版本号，读取时迁移老格式（A23）。身份之间互不可见：键里按「邮箱 + 身份 + 企业」分区（`identity-scope.ts`）。

## 身份和权限

一个账号可以同时是求职者和一家企业的雇主，页面按当前身份显示（ADR 0003）。浏览器里的会话只决定显示什么；所有写操作的 Server Function 都用邮箱在服务器上重新查账号和企业（`getAccountEmployer`），不信任浏览器传来的企业编号。`/admin` 只有设置 `ADMIN_ENABLED=1` 时开放（B24）。

## Server Functions

| 文件 | 函数 |
| --- | --- |
| `src/app/login/actions.ts` | `signInAccount`、`accountStatus`、`openEmployerForAccount` |
| `src/app/jobs/[id]/actions.ts` | `revealContact`、`reportJob` |
| `src/app/employer/actions.ts` | `getMyJobs`、`getMyJob`、`getContactViewCounts`、`parseDraft`、`chatTurn`、`publishJob`、`editMyJob`、`closeMyJob`、`confirmHires`、`refreshMyJob`、`getMyEmployer`、`lookupBusiness`、`verifyBusiness` |
| `src/app/admin/actions.ts` | `getModerationQueue`、`approveJob`、`takeDownJob`、`dismissReports`、`banJobEmployer` |

请求、响应和错误的详细说明在阶段三写进 `docs/api.md`（C12-1）。

## 发布职位的路径

1. 雇主粘贴或对话输入 → `parseDraft` / `chatTurn`（`src/lib/ai-post/`，确定性规则，接口按以后接模型设计）。
2. 表单校验 → `checkJob`（`src/lib/compliance/`）：低于最低工资、收费、卖签证、按种族或国籍招人直接拦截；高风险行业进人工审核。
3. `publishJob` 在服务器上再查一次身份和合规，写进 `data.ts`；需要审核的职位状态是 `pending_review`，在 `/admin` 处理。

## 联系方式

每个职位由雇主选择是否公开联系方式（ADR 0002）。公开的职位，登录的求职者在详情页查看，查看记录在服务器；不公开的，双方在聊天里交换，发起方先提供自己的资料。

## 渲染和部署

- Cache Components 开启：静态部分预渲染，依赖请求的部分（会话、`usePathname` 的动态路由）放在 `Suspense` 里流式输出。底部导航和顶栏导航有静态的占位，不开 JavaScript 也能用。
- Cloudflare Workers + OpenNext（ADR 0004）。内存数据在多个实例间不共享，演示站上发布的职位可能消失，这是阶段三要解决的问题。

## 测试

- `npm run check`：Prettier、`tsc`、ESLint、Vitest（逻辑都写单测，`*.test.ts` 和代码放一起）、生产构建。
- `npm run test:e2e`：Playwright，复用正在运行的开发服务器（`E2E_PORT`），手机和桌面两个项目，含 axe 无障碍检查。
