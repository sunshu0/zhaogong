# 0005 数据库与 ORM：Drizzle + libSQL

- 状态：已采纳
- 日期：2026-10-15（#8，`b/8-db`）；选型最早在 2026-10-13 的第 8 轮定下（`3b8eba8`，当时撤回，第 12 轮重新启用）

## 情况

找工要做成完整产品（第 12 轮），`data.ts` 里的进程内存要换成真正的数据库（ADR 0001）。约束：

- 本机开发和测试不能依赖外部服务；
- 线上部署在 Cloudflare Workers（ADR 0004），数据库驱动要能在 Workers 上用；
- `data.ts` 的函数签名不变，页面和 Server Functions 一行不改；
- 浏览器测试两个进程并行写，本机数据库不能因为并发写入报错。

## 决定

- **libSQL**（SQLite 的分支）做数据库，**Drizzle ORM** 写表结构和查询。`DATABASE_URL` 决定连哪个库：默认本机文件 `file:./data/zhaogong.db`，测试用 `file::memory:`，以后线上用远程 libSQL 地址加 `DATABASE_AUTH_TOKEN`（选 Turso 还是 D1 见 ADR 0006，由用户决定，#15）。
- 表结构在 `src/db/schema.ts`，形状跟 `src/lib/types.ts` 一致；列表和小对象存 JSON，**钱以分为单位存整数**（24.5 → 2450），在 `data.ts` 边界换算。
- **版本化迁移**放在 `drizzle/`（`drizzle-kit generate` 生成，人工检查）。`0001` 里把第 10 轮以前存成单个值的用工类型转换成列表（B20）。
- **第一次用到数据库时**完成准备（`src/db/ready.ts` 的 `database()`）：跑迁移；库是空的且 `DEMO_DATA` 打开（开发和测试默认打开，生产默认关闭）时导入 `src/mock` 的演示数据。不放在启动钩子里，是因为 `file::memory:` 每个模块实例各有一个库。两个实例同时迁移或导入时，后到的一方发现已经做完就跳过。
- **编号**沿用演示数据的格式：前缀加递增数字（`j20`、`e9`、`r1`），由 `nextId` 在同一事务里取最大值加一。
- **同一进程里的语句、批处理和事务排队执行**（`src/db/one-at-a-time.ts`）：本机 SQLite 文件只有一个写入者，两个请求同时写时后一个会报 `SQLITE_BUSY`，浏览器测试稳定触发。队列按进程，正好对应一个开发服务器或一个 Worker 实例。
- **测试**：每个测试文件一个内存数据库，`resetDatabaseForTests()` 重新开始；`data.ts` 的单测改为对它跑。
- 命令：`npm run db:migrate`、`db:seed`、`db:reset`、`db:generate`（README 有本机起库的说明）。

## 后果

- 页面、组件、Server Functions 不变；`data.ts` 换了函数体。
- 本机开发多了 `data/` 文件夹（不进 git）；删掉它或 `db:reset` 回到演示数据。
- 写入排队只在单个进程内有效。线上多个 Worker 实例同时写，要靠远程数据库自己的并发控制，选型时要验证（ADR 0006）。
- 依赖：`@libsql/client`、`drizzle-orm`，开发依赖 `drizzle-kit`、`tsx`。
- 登录验证码和服务器会话（#9）、聊天和交换（#10）、举报和审核（#11）都存进这同一个库。
