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
| [0008](0008-job-expiry-at-read-time.md) | 过期职位读取时判断，不跑定时任务 | 已采纳 |
| [0009](0009-account-deletion.md) | 导出数据和删除账号：删什么、留什么 | 已采纳 |
| [0010](0010-moderation-stats.md) | 审核数据：每次请求时从整张表算，记下举报的处理时间 | 已采纳 |
| [0011](0011-manual-business-verification.md) | 企业验证改为审核员人工核对：申请、核对清单、驳回理由 | 已采纳 |
| [0012](0012-employer-teams.md) | 雇主多人管理：一家企业一个团队，管理员和成员，聊天按企业共享 | 已采纳 |
| [0013](0013-job-roles.md) | 岗位类别：职位和求职者按类别比较，不再靠关键词 | 已采纳 |
| [0014](0014-external-jobs-sources-and-rules.md) | 外部职位：只读官方公开接口，只存事实，先审后显示 | 已采纳；上线前请律师审阅 |
| [0015](0015-two-way-chat.md) | 双方聊天：一条对话双方共用，演示内容只给演示账号 | 已采纳（第二部分在做） |
| [0017](0017-seeker-profile-on-the-account.md) | 求职者主页存在账号上，浏览器留一份副本，两边不一样时问用户 | 已采纳 |
| [0018](0018-ai-posting-model.md) | AI 发帖接入 Claude：模型听懂和追问，规则把关，失败就说不可用；每个账号有限额，用量进审核数据 | 已采纳 |
| [0019](0019-application-outcomes-at-read-time.md) | 已录用和职位结束：录用存在申请上，「职位已结束」和给申请人的通知在读取时算 | 已采纳 |
| [0020](0020-external-saved-and-alerts.md) | 外部职位的收藏和提醒：新表，提醒表加分区 | 已采纳 |
| [0021](0021-round19-interface-conventions.md) | Round 19 的界面约定：卡片、整张卡的链接、共用的 Select 和骨架屏 | 已采纳 |
| [0022](0022-employer-page-on-the-server.md) | 企业主页存到服务器，属于企业：团队和访客看同一份，只有管理员能改，私密交换资料留在各人浏览器 | 已采纳 |
| [0023](0023-interface-language.md) | 中英切换：自写字典，网址不变，内部按语言各预渲染一份，proxy 按 cookie 改写；英文字典只在英文页面加载（#240） | 已采纳 |

新编号由执行 C 统一分配：要写新 ADR 时先在队列里要一个号，避免两条线撞号。
