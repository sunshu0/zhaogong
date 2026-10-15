# 0006 线上数据库：Turso 还是 Cloudflare D1

- 状态：**待用户决定**（#15）
- 日期：2026-10-15（执行 B 起草，跟在 #8 之后）

## 情况

找工从第 12 轮起是带后端的完整产品。#8 把 `src/lib/data.ts` 接到了数据库（0005）：

- 表结构在 `src/db/schema.ts`，迁移在 `drizzle/`，用 `drizzle-kit generate` 生成，按版本逐个升级（`src/db/migrations.test.ts` 验证从第一版升到最新版）。
- 本机和测试都用 **libSQL**（SQLite 的分支）：开发时是文件 `data/zhaogong.db`，测试时每个测试文件一个内存数据库。驱动是 `@libsql/client`。`data.ts` 有几处用交互式事务：取下一个编号再写入，以及封禁雇主时连同职位一起下架。
- 线上演示站跑在 **Cloudflare Workers**（OpenNext，0004）。Worker 里没有本地文件系统，线上不能沿用本机的数据库文件，要换成网络上的数据库。

两个候选都是 SQLite 方言，现有的表结构和迁移 SQL 都能用：Turso（托管的 libSQL）和 Cloudflare D1。

## 选项一：Turso

- **代码改动最小。** 驱动不变，还是 `@libsql/client`，Worker 里用它的 web 版（走 HTTP）。`DATABASE_URL` 换成 Turso 的地址，再配一个 `DATABASE_AUTH_TOKEN`。`data.ts` 里的事务照常可用。
- **迁移不变。** `drizzle.config.ts` 本来就用 `turso` 方言；部署前对线上库跑同一套迁移即可。
- **多一家服务商。** 要在 Turso 开账号、建库，令牌存成 Worker 的密钥。数据库和 Worker 不在同一家，每个请求都要跨网络；建库时可以选离新西兰近的区域。
- 本机、测试、线上三处是同一种数据库，行为差别最小。

## 选项二：Cloudflare D1

- **全部在 Cloudflare。** 不用另开服务商账号，Worker 通过绑定直接访问，不必保存数据库令牌。
- **要换驱动。** 线上用 `drizzle-orm/d1`，`getDb()` 要从 OpenNext 的 Cloudflare 上下文里取绑定。本机要么用 Wrangler 模拟的 D1，要么继续用 libSQL 文件；后一种等于本机和线上用两种驱动。
- **事务要改写。** D1 不支持交互式事务，只能一次提交一批语句。`data.ts` 里取编号再写入、封禁并下架这几处，都要改成批量语句或别的写法，并补测试。
- **迁移方式不同。** D1 用 `wrangler d1 migrations apply`。`drizzle-kit` 生成的 SQL 可以复用，但目录约定和执行命令都要跟着换。

## 两者相同的地方

- 表结构、种子数据（`src/mock`）和 `data.ts` 的函数签名都不变，页面和 Server Functions 不受影响。
- 建远程数据库之前，都要用户先确认账号和费用。现在**不建任何远程数据库，也不部署**。
- 演示数据：线上设 `DEMO_DATA=true` 后，空库在第一次访问时自动导入演示数据（`src/db/ready.ts`）。

## 建议

用户能接受多开一个 Turso 账号的话，选 **Turso**：改动最少，本机和线上行为一致。希望全部留在 Cloudflare 一家的话，选 **D1**，但要多做一项工作：改用 D1 驱动、去掉交互式事务，然后重新验收。

## 决定

（等用户选定后填写：选哪个、为什么、谁来建库、令牌或绑定怎么配。）

## 后果

- 选定之前，**不要用当前代码重新发布** Cloudflare 演示站：代码已经要求有数据库，而 Worker 里没有本机文件（`docs/cloudflare-deployment.md`）。
