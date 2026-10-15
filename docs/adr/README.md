# 架构决定记录（ADR）

每份记录一个真实做过的决定：当时的情况、决定了什么、带来的后果。日期是决定落地的那天（对应的提交写在文中）。决定被推翻时不删旧记录，新写一份并把旧的状态改成「已被 000N 取代」。

| 编号 | 决定 | 状态 |
| --- | --- | --- |
| [0001](0001-frontend-first-async-data-layer.md) | 先做前端，所有服务器数据走异步的 `data.ts` | 已采纳（阶段三换函数体） |
| [0002](0002-two-contact-modes.md) | 联系方式两套：雇主公开，或聊天中交换、发起方先提供 | 已采纳 |
| [0003](0003-one-account-two-identities.md) | 一个账号两种身份，可切换 | 已采纳 |
| [0004](0004-cloudflare-workers-opennext.md) | 部署到 Cloudflare Workers + OpenNext | 已采纳 |
| [0005](0005-database-drizzle-libsql.md) | 数据库与 ORM：Drizzle + libSQL，`data.ts` 接数据库 | 已采纳 |
| [0006](0006-online-database.md) | 线上数据库：Turso 与 D1 的取舍 | 待用户决定（#15） |
| [0007](0007-sign-in-and-sessions.md) | 登录与会话：邮箱验证码 + httpOnly cookie 的服务器会话 | 已采纳；生产环境的邮件服务待用户决定（#16） |

新编号由执行 C 统一分配：要写新 ADR 时先在队列里要一个号，避免两条线撞号。
