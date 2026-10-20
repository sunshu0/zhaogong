# 0031 迁移到 D1 的做法：每次写入只交一条语句或一个 batch，本机照旧用 libSQL 但照 D1 的规矩跑

- 状态：已采纳（导师 10-20 采纳；D1 迁移会话 local_1010a53c 起草）
- 日期：2026-10-20。接 ADR 0029（线上数据库用 Cloudflare D1，用户 10-20 23:4x 定的）。编号由执行 C 10-20 23:4x 登记。

## 情况

ADR 0029 定了线上用 D1，代码怎么改留给这一份。现在的代码（main `69f8029`）：

- 驱动是 `@libsql/client` + `drizzle-orm/libsql`（ADR 0005）。本机是文件库 `data/zhaogong.db`，测试每个文件一个内存库；同一进程里的语句、batch、事务排队执行（`src/db/one-at-a-time.ts`）。
- **交互式事务**（`db.transaction(async (tx) => …)`，在事务里先读、再按读到的写）：main 上 18 个文件 32 处，见下面第 2 节的表。还没合并的分支另有几处：A 的举报证据（`report-evidence.ts`、`data.ts`）、C 的 #349 团队邀请链接（`team-links.ts`、`team.ts`）、B 的 #358「聊过的人」（`conversations.ts`、`job-applications.ts`），合起来约 36 处。
- 编号：`nextId` 在事务里取最大值加一（`j20`、`e9`、`r1`、`a3`）；团队邀请 `ti` 和企业认证 `v` 用的是 `count(*) + 1`。
- 外键：代码里没有 `PRAGMA foreign_keys`，但 `@libsql/client` 0.18 打开的连接默认就是 `foreign_keys = 1`（文件库和内存库都是，10-21 实测），所以本机一直在检查外键。
- 迁移 `drizzle/0000`–`0027` 用 `drizzle-kit generate`（`turso` 方言）生成，本机第一次用库时由 drizzle 的迁移器执行，记在 `__drizzle_migrations`。还没合并的 0028（A）、0029（C）、0030（B）排着。

D1 跟这些有关的事实（Cloudflare 文档，2026-10-20 查的）：

1. **没有交互式事务。** SQL 里不能写 `BEGIN` / `COMMIT`，drizzle 的 `db.transaction()` 在 D1 上会失败。能用的是 `batch()`：一批语句按顺序执行，**整批是一个事务**，中间任何一条出错全部回滚。
2. **每条语句本身是原子的。** 一个库的查询由主库一条一条执行，所以一条 `INSERT … SELECT … WHERE …` 或带条件的 `UPDATE` 里读到的和写下的是同一个时刻的状态，别的请求插不进来。
3. **外键永远检查**，相当于一直开着 `PRAGMA foreign_keys = on`，自己关不掉；迁移里要临时违反只能写 `PRAGMA defer_foreign_keys = on`（到事务结束前必须恢复一致）。
4. **限额：** 每条语句最多 **100 个绑定参数**、100 KB；一次 batch 最长 30 秒；每次 Worker 请求最多 **50 条查询（免费方案）/ 1000 条（付费方案）**。文档没说清 batch 里的每一条算不算一次查询，这里保守按每条都算。
5. 支持 `RETURNING`、`INSERT … ON CONFLICT`、JSON 函数（`json_each`）。
6. 建库时给位置提示（`--location=oc`），`wrangler.jsonc` 里只写绑定。迁移用 `wrangler d1 migrations apply`，按文件名顺序执行一个文件夹里的 `.sql`，记在 `d1_migrations` 表。

## 决定

### 1. 总规矩：一次写入 = 一条语句或一个 batch

- **所有写入只用两种形式：** 一条语句，或者 `db.batch([...])`。drizzle 在 libSQL 和 D1 上都有 `db.batch`，两边都是一个事务、要么全成要么全不成，所以同一份代码在本机和线上的原子性一样。
- **写的时候必须仍然成立的条件，写进写语句自己的 `WHERE` / `SELECT` 里**，由数据库在写的那一刻判断。写之前可以先读，但读到的只用来算要写的值、给用户说原因；读到的东西过期了，写语句会落空（0 行），代码看 `RETURNING` 回来几行决定结果，落空再读一次只为分辨原因（比如「没有账号」还是「已经收藏过」）。
- `Db` 类型里去掉 `transaction`，再加一条 eslint 规则禁止 `.transaction(`，以后写不出交互式事务。
- **不开 D1 的读副本**（Sessions API）：读写都走主库，读得到自己刚写的，跟现在一样。

### 2. 五种改法，32 处逐个归类

| 改法 | 做法 | 用在哪里 |
| --- | --- | --- |
| **A 只写不判断** | 直接 `db.batch([...])` | `conversations.addSharedMessage`、`addSharedExchange`；`seed.seedDemoData`（按 100 个参数切块）；`job-renewals.renewJob`（先 `INSERT INTO job_renewals … SELECT … expires_at FROM jobs WHERE id = ?` 记下旧的到期日，再 `UPDATE jobs`，同一个 batch；职位不在时两条都是 0 行，返回 `undefined`）；`job-applications.withdrawApplication`（`DELETE interviews WHERE application_id IN (SELECT id FROM job_applications WHERE …)`，再删申请） |
| **B 没有才写** | 一条 `INSERT … SELECT … WHERE EXISTS (账号) AND NOT EXISTS (同一条) RETURNING`，或 `ON CONFLICT DO NOTHING / DO UPDATE … RETURNING` | `job-applications.addApplication`、`job-stats.recordChatStart`、`moderators.grantModerator`、`saved-jobs.saveJob`（职位存在也写进条件）、`saved-external-jobs.saveExternalJob`（「还在展示」那几个条件照 `isShown` 写成 SQL）、`resume-shares.saveResumeShare`、`seeker-profiles.saveSeekerProfile`、`employer-profiles.saveEmployerPage`（条件里查这个账号属于这家企业、是管理员）、`data.openEmployerIdentity`（`UPDATE accounts … WHERE email = ? AND employer_id IS NULL AND NOT EXISTS (SELECT 1 FROM accounts WHERE employer_id = ?)`）、`team.cancelInvite`（`UPDATE … WHERE status = 'pending' AND EXISTS (操作人是这家的管理员)`） |
| **C 有上限、不能是最后一个** | 数量写进同一条语句的条件：`… WHERE (SELECT count(*) …) < N` | `job-alerts.createJobAlert`（重复和 `ALERT_LIMIT`）、`moderators.revokeModerator`（`DELETE … WHERE email = ? AND (SELECT count(*) FROM moderators) > 1 RETURNING`） |
| **D 取编号再写** | 取号和插入合成一条：`INSERT INTO jobs (id, …) SELECT 'j' \|\| (coalesce(max(cast(substr(id, 2) as integer)), 0) + 1), … FROM jobs WHERE id GLOB 'j[0-9]*' RETURNING id` | `data.createJob`、`submitReport`、`addModerationLog`、`createEmployer`；`team.inviteToTeam` 的 `ti`、`verification-requests.submitVerification` 的 `v` 也改成取最大值加一（现在用 `count(*) + 1`，删号会删掉邀请，之后再发邀请会撞上已有的编号；顺手修掉，补单测） |
| **E 好几步、要么全做要么全不做，前提可能被别人改** | 见下面「守卫行」和「接力条件」 | 其余各处，见下 |

**E1「守卫行」：** 迁移 0031 加一张只在 batch 里用的表 `write_guards (token TEXT PRIMARY KEY)`。一个 batch 写成：

1. `INSERT INTO write_guards (token) SELECT :token WHERE <前提>`（`:token` 每次随机）；
2. 每条写语句的条件都加 `AND EXISTS (SELECT 1 FROM write_guards WHERE token = :token)`；
3. 最后 `DELETE FROM write_guards WHERE token = :token RETURNING token`。

前提不成立时第 1 条插不进去，后面的写全部落空，第 3 条什么都不回；前提成立就全部写下。batch 是原子的，这张表在 batch 之外永远是空的。前提在 batch 开始的那一刻判断一次，后面的写改了前提里的数据也不影响（这是不在每条语句里重复写前提的原因）。写成一个小工具 `src/db/guarded-batch.ts`。

**前提里放「读到的东西没变」就是乐观并发：** 先读、在 JS 里按规则算，batch 的前提写「我读到的那几行现在还是那样」（比如队员的 `email:角色` 拼起来跟读到的一样）。落空就重新读、重算、再试，**最多 3 次**；还不行返回新的结果「忙，请再试一次」，页面照 ADR 0024 在按下的地方说明。

**E2「接力条件」：** 第一条写语句本身就是带条件的状态变化（比如 `status = 'pending'` 才改成「已批准」），后面的语句以第一条刚写下的值为条件（同一个状态、同一个时间戳、同一个操作人），第一条落空后面就都落空，不用守卫行。

| E 类 | 怎么写 |
| --- | --- |
| `account-data.deleteAccount` | E1。前提：账号还在；不是最后一个管理员；是审核员的话不是最后一个；**队友人数等于读到的**（决定走「企业留给队友」还是「企业下架」哪一支）。原来先查出编号再 `inArray` 的地方都改成子查询（`WHERE conversation_id IN (SELECT id FROM conversations WHERE …)`），先删子表再删父表，读和删之间新开的对话也删得掉，参数也不会超过 100 个。整批大约 45 条语句。 |
| `team.inviteToTeam` | E1 + D。前提：操作人是管理员；对方有账号、没有企业、不是队员；没有未过期的待答邀请；队员 + 待答 < 上限；24 小时内发的 < `INVITES_PER_DAY`。都能写成 SQL，不用快照。 |
| `team.answerInvite` | E1。前提：邀请待答、没过期、企业没被封；账号没有企业；队员 < `TEAM_MAX`。然后改账号、改邀请。拒绝是一条带条件的 `UPDATE`（B 类）。 |
| `team.changeTeam` | E1 + 乐观并发。`checkTeamChange` 是 JS 里的规则（不能去掉最后一个管理员等），前提写「队员和角色跟读到的一样」。 |
| `verification-requests.decideVerification` | E2。先 `UPDATE verification_requests … WHERE id = ? AND status = 'pending' RETURNING *`，再改企业：`… WHERE id = ? AND EXISTS (SELECT 1 FROM verification_requests WHERE id = ? AND status = 'approved' AND decided_at = ? AND decided_by_email = ?)`；「已是认可雇主就保留」写成 `CASE`。 |
| `verification-requests.submitVerification` | E1 + D。前提：这家没有待审的；NZBN 没有待审的、没被别家用。 |
| `conversations.answerSharedExchange` | E2（现在就是带条件的 `UPDATE … RETURNING`，第二条以 `responded_at` 接力）。 |
| `data.banEmployer` | E2。`UPDATE employers SET banned_at = :at WHERE id = ? RETURNING`，再 `UPDATE jobs … WHERE employer_id = ? AND status IN (…) AND EXISTS (… banned_at = :at) RETURNING id`，返回的编号在 JS 里按原来的顺序排。 |
| `external-jobs.blockCompany` | E1。前提：没有「下架」记录，且这次不是对已有记录再「停止」。upsert 记录 + 下架职位。 |
| `external-jobs.unblockCompany` | E1。前提：有记录；删记录 + 职位回到待审。 |
| `external-jobs.saveCompanyFeed` | 把判断搬进 SQL：新的和已有的都用 `INSERT … ON CONFLICT (id) DO UPDATE`，「改了标题、链接或标记的已批准职位回到待审」写成 `review = CASE WHEN review = 'approved' AND (title IS NOT excluded.title OR …) THEN 'pending' ELSE review END`；这次没出现的写成一条 `UPDATE … WHERE company_id = ? AND removed_at IS NULL AND id NOT IN (SELECT value FROM json_each(?))`（编号列表当一个 JSON 参数，不会超过 100 个）。整批一个 batch。返回的几个数按读到的算，只用来打印日志。 |

还没合并的分支里的几处（举报证据、邀请链接、聊过的人）照同样的五种改法，等它们合并后再改，见第 7 节。

### 3. 限额和外键

- **每条语句 ≤ 100 个参数：** 演示数据的多行插入按 100 个参数切块；`inArray(编号列表)` 改成子查询或 `json_each(?)`。本机的 libSQL 包装层（第 4 节）数参数，超过 100 就报错，在本机就能发现。
- **每次请求的查询条数：** 删号一次大约 45 条，加上页面本身的读，免费方案的 50 条很可能不够。另外 Workers 免费方案每个请求 CPU 只有 10 ms、脚本压缩后上限 3 MiB，Next 应用一般也超。**写进「待用户」：正式上线大概要 Workers 付费方案（每月 5 美元）**；在那之前演示站先用免费方案试，删号这类长操作超了限额会报错，页面照 ADR 0024 说「没办成，请再试」，不会写一半（batch 是原子的）。
- **外键：** 本机的 libSQL 默认已经检查外键，跟 D1 一样；包装层开库时确认一次 `PRAGMA foreign_keys` 是 1，不是就报错（以后升级驱动改了默认值能发现）。要重建表的迁移（比如 B 的 0030）开头写 `PRAGMA defer_foreign_keys = on`，不写 `PRAGMA foreign_keys = OFF`（D1 不认）。

### 4. 本机开发和测试：继续用 libSQL，加一层「D1 规矩」，再用本机 D1 跑一遍数据库层的测试

选这个而不是本机也全用 D1（miniflare），原因：

- 内存紧。每个测试文件起一个 workerd 要几十到上百 MB，全量单测 1275 条；现在每个文件一个内存库几乎不占。
- e2e 的整套（`next build` + `next start`、`db:reset`、e2e 锁）不用改。

**怎么保证两边一致：**

1. **同一份代码、同样的写法。** 第 1、2 节的规矩对两种驱动一样，代码里没有只在一边能用的东西。
2. **libSQL 包装层照 D1 的规矩拦：**（从现在的 `one-at-a-time.ts` 扩出来）不给 `transaction`；语句里出现 `BEGIN` / `COMMIT` 报错；每条语句参数超过 100 报错；确认外键检查开着。
3. **数据库层的单测在本机 D1 上再跑一遍。** 加一个 vitest 配置 `vitest.d1.config.ts`：用 node_modules 里已有的 miniflare（随 `@opennextjs/cloudflare` / wrangler 装进来的，不用另外下载）起本机 D1，照 wrangler 的方式把 `drizzle/*.sql` 逐个执行，然后跑 `src/db/**/*.test.ts` 和 `data.test.ts` 同一批测试文件（`database()` 看测试变量选驱动）。命令 `npm run test:d1`，同时只开 1–2 个工作进程。**门槛加上这一步**（空闲 ≥3 GB 时跑）。
4. **最后验收在 D1 上走一遍：** `opennextjs-cloudflare preview` 用本机 D1（wrangler 的本机状态），注册、登录（开发验证码）、发职位、聊天、删号。

**驱动怎么选（`src/db/client.ts`）：** 设了 `DATABASE_URL`（`file:`、`:memory:`）→ libSQL，跟现在一样；没设、并且 `getCloudflareContext({ async: true }).env.DB` 存在 → D1（`drizzle-orm/d1`），每个请求用当时的绑定建一次 drizzle（很便宜）；两样都没有 → 本机文件库，跟现在一样。线上不设 `DATABASE_URL`、`DATABASE_AUTH_TOKEN`。`@libsql/client` 只在 libSQL 那一支里动态导入，Worker 里用不上就不打包。

**单测怎么测原子性和并发**（每处改写都要有）：

- **原子性：** 测试里临时建一个触发器，让 batch 里最后一条语句出错（`RAISE(ABORT)`），断言前面的写全都没留下。
- **并发：** 同时发 N 个（`Promise.all`）。libSQL 的排队让各自的「读」和「写」交错执行（甲读、乙读、甲写、乙写），正好是会出错的那种顺序；断言上限没被超过、同一条只写一次、状态只变一次、编号不重复。乐观并发那几处再测「前提被改了 → 重试成功」和「一直被改 → 返回忙」。
- 两种驱动都跑这些测试。

### 5. 迁移文件

- `drizzle.config.ts` 的方言从 `turso` 改成 `sqlite`（`turso` 方言会生成 `ALTER COLUMN`，D1 不能执行）。文件夹还是 `drizzle/`，文件名不变。
- `wrangler.jsonc` 的 D1 绑定写 `"migrations_dir": "drizzle"`。wrangler 按文件名顺序执行这里的 `.sql`；drizzle 的 `--> statement-breakpoint` 是 SQL 注释，不碍事；`meta/` 里不是 `.sql`，wrangler 不看。
- **0000–0030 怎么接：** 线上 D1 是新库（演示站从来没有过数据库），`wrangler d1 migrations apply zhaogong --remote` 从 0000 跑到最新，记在 `d1_migrations`。本机的 libSQL 库照旧由 drizzle 迁移器执行，记在 `__drizzle_migrations`，不用动。两边各记各的账，读的是同一批 `.sql` 文件。
- **新单测**（`migrations.test.ts` 里加）：`drizzle/*.sql` 和 `_journal.json` 一一对应；文件里没有 `BEGIN`、`COMMIT`、`PRAGMA foreign_keys`（只许 `defer_foreign_keys`）；照 wrangler 的方式执行完的表结构（`sqlite_master`）跟 drizzle 迁移器的结果一样。
- **迁移 0031**（这一项要用的号，C 的表里是空号）：`write_guards` 表。A 的 0028、C 的 0029、B 的 0030 不变，它们合并后我 rebase，0031 排在最后。

### 6. wrangler.jsonc 和部署

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "zhaogong",
    "database_id": "建库后填（本机预览先用占位值）",
    "migrations_dir": "drizzle",
  },
],
```

- 位置提示不写在这里，写在建库命令里：`wrangler d1 create zhaogong --location=oc`（用户开账号以后做，ADR 0029）。本机预览和 `migrations apply --local` 不连账号，`database_id` 先用占位值；实现时先验证占位值本机能用。
- `cloudflare-env.d.ts` 用 `npm run cf:typegen` 重新生成（多出 `DB: D1Database`）。
- **演示数据：** 线上不再「第一次访问时导入」（一次要上百条语句，超过每次请求的限额），改成部署时跑命令导入。命令行工具（`migrate`、`seed`、`admin:grant`、`import:external`）加一个选项走 wrangler 的 `getPlatformProxy` 拿 D1 绑定：本机 D1 现在就能做通；远程那一步要用户 `wrangler login` 以后才能跑，写进部署清单。
- 部署清单（`docs/cloudflare-deployment.md`，C 的 ADR 0029 分支正在改第 2、3、5 节）在代码合并时补上：建库、`migrations apply --remote`、导入演示数据、授审核员，写到「只差 Cloudflare 账号」。

### 7. 做的顺序（避开别线没合并的分支）

几条线有没合并的分支在改 `src/db`：A 的举报证据（`account-data.ts`、`data.ts`、`schema.ts`、0028）、C 的 #349（`team.ts`、`account-data.ts`、`schema.ts`）、B 的 #358（`conversations.ts`、`job-applications.ts`、`account-data.ts`、`schema.ts`、0030）。所以：

1. **先做没人碰的：** 驱动和规矩层（`client.ts`、`ready.ts`、`migrate.ts`、`one-at-a-time.ts`）、`guarded-batch.ts`、`drizzle.config.ts`、`wrangler.jsonc`、`vitest.d1.config.ts`、迁移的新单测；然后改 `employer-profiles`、`external-jobs`、`job-alerts`、`job-renewals`、`job-stats`、`moderators`、`resume-shares`、`saved-external-jobs`、`saved-jobs`、`seed`、`seeker-profiles`、`verification-requests` 这 12 个文件的 18 处。`schema.ts` 和迁移 0031 等别线的迁移合并后再加（避免 `_journal.json` 冲突），在那之前 `write_guards` 先只用在测试里建。
2. **它们合并以后** rebase，再改 `account-data`、`conversations`、`job-applications`、`team`、`data.ts` 的 14 处，加上分支带进来的几处。
3. 每一步一个 PR，照常门槛（check、build、e2e 照现有的跑），加 `test:d1`；最后一个 PR 合并后在 opennext preview 上做第 4 节的验收。

## 后果

- 约 36 处改写，每处都有原子性和并发的单测，两种驱动各跑一遍。门槛多一步 `test:d1`。
- 新的结果值「忙，请再试一次」（乐观并发重试 3 次还落空），只在团队变更等少数地方出现。
- 顺手修掉：`ti`、`v` 编号用 `count(*) + 1`，删号后会撞号。
- 新增一张表 `write_guards`（迁移 0031），平时是空的。
- **待用户：** 正式上线大概要 Workers 付费方案（每月 5 美元）：D1 免费方案每次请求 50 条查询，Workers 免费方案每次请求 CPU 10 ms、脚本 3 MiB。不定之前先按免费方案做，超限时不会写一半。
- 不建库、不部署、不注册任何账号（ADR 0029）。
