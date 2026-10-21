# Cloudflare 部署清单

用户 10-20 定的：**放在境外，跑在 Cloudflare Workers，数据库用 Cloudflare D1**（23:4x 从 Turso 改过来，理由和代价见 ADR 0029）。**集成分支已支持 D1**：驱动切换、交互式事务改写和本机维护命令已完成（ADR 0031），最终构建和浏览器验收尚未完成，未合并进 main。远程数据初始化工具仍待完成，不是只差账号。这份清单记录上线准备；本轮没有部署或注册账号。 标着「用户做」的步骤要以公司名义注册或付费（落地主体见 Progress「用户决定 10-20 01:2x」），别人不能代做。

10-14 那次发布的是只读模拟数据的前端演示（Worker `zhaogong-demo`，`zhaogong-demo.zhaogong.workers.dev`），那时还没有数据库。下面写的是有数据库以后的做法。

## 0. 先决定的事

- **落地主体和账号（用户做）：** Cloudflare 账号（Worker、D1、R2 都在里面）和域名，都以公司名义注册。
- **登录验证码的邮件服务（Issue #16，还没定）：** 生产环境没有邮件服务就发不出验证码（`src/lib/auth/delivery.ts`：`canSendCodes()` 为假时直接拒绝），也就**没人能登录**。正式开放前一定要定下来。只放演示的话，可以先不开放登录，但所有要登录的功能就都用不了。
- **Clarity：** 同意提示和敏感页面屏蔽已集成，启用前仍需配置项目 ID，见第 2 节。

## 1. 版本和配置

- Node.js 24（`.node-version`，24.19.0）；Next.js 16.3.8；`@opennextjs/cloudflare` 1.20.10；Wrangler 4.150.0；`@libsql/client` 0.18.0；`drizzle-orm` 和 drizzle-kit 照 `package.json`。
- `wrangler.jsonc`：Worker `zhaogong-demo`，`compatibility_date` 2026-09-01，`nodejs_compat` 和 `global_fetch_strictly_public`。日期在 2025-04-01 之后，开了 `nodejs_compat` 就会自动把变量和密钥放进 `process.env`，代码不用改（[Cloudflare 说明](https://developers.cloudflare.com/changelog/post/2025-03-11-process-env-support/)）。正式上线时 Worker 的名字可以改：`name` 和 `services[0].service` 要一起改。
- `open-next.config.ts`：静态资源增量缓存，`enableCacheInterception: false`（PPR 要靠 Next 自己续上动态内容）。
- Next 16.4.0 在本地 workerd 里会报 `Unexpected loadManifest(/.next/server/preview-props.json)`，所以停在 16.3.8。升级 Next 或 OpenNext 之前，先照第 6 节在本机构建和预览一遍。

## 2. 要设的变量和密钥

都是在 Worker 运行时读的（`process.env`），只有 `NEXT_PUBLIC_*` 和下表标「构建时」的，要在构建时就设好。密钥用 `npx wrangler secret put <名字>`（[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)），不写进代码、配置文件和这份文档。

| 名字 | 类型 | 必须吗 | 做什么、不设会怎样 | 代码 |
| --- | --- | --- | --- | --- |
| `DB`（D1 绑定） | `wrangler.jsonc` 的 `d1_databases` | **必须** | 线上的 D1 库，见第 3 节。不是变量也不是密钥，没有令牌 | （ADR 0031） |
| `DATABASE_URL` | 变量 | 线上不设 | 本机和测试用：libSQL 库的地址，不设就是本地文件 `file:./data/zhaogong.db`。设了它会覆盖 Worker 的 D1 绑定，线上务必移除 | `src/db/client.ts` |
| `DATABASE_AUTH_TOKEN` | 密钥 | 线上不设 | 远程 libSQL 库的令牌；用 D1 以后不需要 | `src/db/client.ts` |
| `AUTH_SECRET` | 密钥 | **必须** | 验证码的 HMAC 密钥。生产环境没有就直接报错（`src/lib/auth/config.ts`） | `src/lib/auth/config.ts` |
| `ZG_EVENTS_SECRET` | 密钥 | 要统计就必须 | 漏斗事件里访客号的 HMAC 密钥（ADR 0025）。生产环境不设就不记事件，日志里会说一次 | `src/lib/events/visitor-key.ts` |
| `NEXT_PUBLIC_CLARITY_ID` | 变量，**构建时** | 要 Clarity 就要 | Clarity 项目 ID，构建时写进浏览器的 JS。已集成同意提示和敏感页面屏蔽`src/components/analytics/Analytics.tsx` | `src/components/analytics/Analytics.tsx` |
| `SITE_URL` | 变量 | 用自己的域名时要 | 绝对链接、robots、sitemap 的地址；不设就照请求的 host | `src/lib/site.ts`、`src/app/robots.ts` |
| `DEMO_DATA` | 变量 | 演示站设 `true` | 生产构建默认 false。设成 true 时，空库在第一次用的时候灌演示数据，首页的数字旁边会标「演示数据」 | `src/db/ready.ts`、`src/config/landing.ts` |
| `ADMIN_ENABLED` | 变量，**构建时和运行时都要** | 演示站不设 | 设成 `1` 才有 `/admin`；还必须登录并具备审核员权限（`requireModerator()`）。正式站启用前先初始化审核员并验收登录 | `src/app/[lang]/admin/enabled.ts` |
| `ANTHROPIC_API_KEY` | 密钥 | 要「对话发布」用模型就要 | 生产环境有它就用 Claude，没有就说这个功能现在用不了 | `src/lib/ai-post/model/` |
| `AI_POST_MODEL` | 变量 | 可以不设 | 换模型；不设用代码里的默认值 | `src/lib/ai-post/model/index.ts` |
| `AI_POST_BASE_URL` | 变量 | 可以不设 | 默认 `https://api.anthropic.com` | `src/lib/ai-post/model/client.ts` |
| `TAKEDOWN_EMAIL` | 变量 | 建议设 | 外部职位页下面「公司要求下架」的联系邮箱；不设就不显示 | `src/config/external-companies.ts` |
| `EXTERNAL_JOBS` | 变量 | 生产环境别设 | `real` 会让空的演示库在后台去公司网站导入真实职位；生产环境默认不导入 | `src/db/ready.ts` |
| `NEXTJS_ENV` | 变量 | 已经在 `wrangler.jsonc` | `production` | `wrangler.jsonc` |
| `EVIDENCE_BUCKET` | **R2 绑定** | **必须** | 举报截图存放的 R2 桶（ADR 0027）。Worker 里没绑就不收截图（举报会报错），见第 4 节第 2a 步 | `src/db/evidence-store.ts` |
| `ZG_EVIDENCE_DIR` | 变量 | 本机可以不设 | 不在 Cloudflare 上时截图放的文件夹，默认 `data/uploads/report-evidence`（`data/` 不进 git） | `src/db/evidence-store.ts` |

只在开发和测试里用的：`ZG_E2E`、`E2E_PORT`、`AI_POST_FAKE`、`AI_POST_LIVE`、`NEXT_PRIVATE_STANDALONE`，线上不要设。

这张表已按 2026-10-22 集成分支核对。新增变量或绑定需更新此表，`scripts/docs-drift.test.mjs` 会检查遗漏。

## 3. 线上数据库：Cloudflare D1

**先完成集成分支的 check、Cloudflare 构建和本地 D1 浏览器验收，再合并部署。** D1 业务改写和本机命令已完成，但远程初始化命令尚未提供。命令用 Wrangler（[D1 说明](https://developers.cloudflare.com/d1/)），由有公司账号权限的人在本机跑。

1. **（用户做）** 用公司名义注册 Cloudflare，在本机 `npx wrangler login`。
2. 建库，位置提示给大洋洲：
   ```sh
   npx wrangler d1 create zhaogong --location=oc
   ```
   `oc` 只是提示，Cloudflare 不保证库落在哪个城市（ADR 0029「代价」）。
3. 把命令打印出来的 `database_id` 写进 `wrangler.jsonc`：
   ```jsonc
   "d1_databases": [{ "binding": "DB", "database_name": "zhaogong", "database_id": "<上一步的 id>", "migrations_dir": "drizzle" }]
   ```
   绑定名、迁移目录以 ADR 0031 定的为准。没有令牌要保管。

### 迁移（每次部署前）

Worker 里不跑迁移（#329）。每次有新的迁移，都在部署 Worker **之前**，在本机对线上库跑：

```sh
npx wrangler d1 migrations apply zhaogong --remote
```

`drizzle/` 的 0000–0031 迁移已在本机 D1 实测，测试也核对了 Wrangler 按文件名排序与 Drizzle 日志排序的最终结构、旧数据保留及外键。Worker 请求中不运行迁移。

### 演示数据

- **演示站：** 必须在开放站点前用命令灌数据；D1 不会在首次请求时 seed，单设 `DEMO_DATA=true` 不会填库。本机命令见末节，远程导入仍待实现。
- **正式站：** 不灌演示数据，`DEMO_DATA` 不设。`admin:grant` 已支持本机 D1（`--d1-local`），远程授予工具仍待实现。正式站启用后台前需完成这一步。
- **查库：** D1 没有对外的数据库连接。国内同事查数据在 Cloudflare 后台，或者 `npx wrangler d1 execute zhaogong --remote --command "<SQL>"`；照 ADR 0026 的精神，只查需要的。

## 4. 部署（Cloudflare）

1. **（用户做）** 用公司名义注册 Cloudflare，在本机 `npx wrangler login`。
2. 设密钥（第 2 节）：`npx wrangler secret put AUTH_SECRET`、`ZG_EVENTS_SECRET`、`ANTHROPIC_API_KEY`（要的话）。变量（`SITE_URL`、`DEMO_DATA` 等）写进 `wrangler.jsonc` 的 `vars`，或者在 Cloudflare 后台设。
2a. **（用户做）举报截图的 R2 桶**（ADR 0027）：以公司名义在 Cloudflare 开 R2，建一个桶（比如 `zhaogong-report-evidence`，位置选亚太 APAC），**不要开公开访问**，也不要绑自定义域名；在 `wrangler.jsonc` 加 `"r2_buckets": [{ "binding": "EVIDENCE_BUCKET", "bucket_name": "zhaogong-report-evidence" }]`。截图只通过 `/api/report-evidence/[id]` 给审核员看。处理完 180 天后和删号时，代码会把文件一起删掉。
3. 对线上 D1 库迁移（第 3 节，ADR 0031 的代码合并后）。
4. 本机预检：`npm run check`，再 `npm run cf:dry-run`（构建加上传前的检查，不上传）。**最终版本尚未完成这一步，先看第 4a 节。**
5. 部署：`npm run cf:deploy`。
6. 验收：首页、职位列表和筛选、职位页、登录（要有邮件服务）、发布职位、聊天、英文页；`/admin` 应该是 404（`ADMIN_ENABLED` 没设）。

以后改用 Workers Builds 自动部署的话：构建命令 `npm run check && npm run cf:build`，部署命令 `npx opennextjs-cloudflare deploy`。构建变量要有 `NODE_VERSION=24.19.0`、`NEXT_TELEMETRY_DISABLED=1`，以及 `NEXT_PUBLIC_CLARITY_ID`（构建时用）（[说明](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)）。

## 3a. 演示站（用户 10-20 23:1x 定：先更新这个，不正式上线）

`zhaogong-demo.zhaogong.workers.dev`：完整版代码，灌演示数据。下面是待执行的部署方案，本轮未查询或使用公司账号。演示站和正式站一样用 Cloudflare D1（ADR 0029），代码已在集成分支支持；要先完成最终门槛并合并，再补齐远程演示数据导入工具。当前不能直接执行到部署完成。

**设置：**

| 名字 | 值 | 为什么 |
| --- | --- | --- |
| `DEMO_DATA` | `true` | 页面显示演示数据；首页数字旁标「演示数据」 |
| `DB`（D1 绑定） | 库 `zhaogong-demo`（第 3 节，`--location=oc`） | 演示站也用正式的库结构，只是数据是演示的；和正式库分开 |
| `AUTH_SECRET` | 随机 32 字节以上 | 生产环境必须有，不然启动就报错 |
| `ZG_EVENTS_SECRET` | 随机 32 字节以上 | 漏斗统计；不设就不记 |
| `EVIDENCE_BUCKET` | R2 桶（第 4 节第 2a 步） | 举报截图；不绑的话登录不了也用不上，但代码在 Worker 里会拒收截图 |
| `DATABASE_URL`、`DATABASE_AUTH_TOKEN` | **不设** | 线上用 D1 绑定，不用 libSQL 地址和令牌 |
| `ADMIN_ENABLED` | **不设** | 演示站不开审核后台 |
| `ANTHROPIC_API_KEY` | **不设** | 对话发布显示「现在用不了」 |
| `EXTERNAL_JOBS` | **不设** | 不去公司网站导入真实职位 |
| `NEXT_PUBLIC_CLARITY_ID` | **不设** | 演示站不录 Clarity |

**只能浏览、不能登录：** 没有邮件服务（#16），验证码发不出去。登录页在发不出验证码的环境里（`canSendCodes()` 为假）不显示表单，直接说「这个演示站暂时不能登录」并给「去看职位」的链接（#332）。

**用户开完账号、0031 合并后照着跑（一步一行，在仓库根目录，PowerShell 或 Git Bash）：**

1. `npx wrangler login`（浏览器里用公司的 Cloudflare 账号授权）
2. `npx wrangler d1 create zhaogong-demo --location=oc`（记下打印出来的 `database_id`）
3. `wrangler.jsonc` 的 `d1_databases` 加绑定 `DB` → `zhaogong-demo`、上一步的 `database_id`（写法见第 3 节，0031）
4. 在 Cloudflare 后台建 R2 桶 `zhaogong-report-evidence`（不开公开访问），`wrangler.jsonc` 加 `r2_buckets` 绑定（第 4 节第 2a 步）
5. `wrangler.jsonc` 的 `vars` 加 `"DEMO_DATA": "true"`
6. `npx wrangler secret put AUTH_SECRET`（粘贴 `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` 的结果）
7. `npx wrangler secret put ZG_EVENTS_SECRET`（同上，另生成一个）
8. 对库迁移：`npx wrangler d1 migrations apply zhaogong-demo --remote`（第 3 节「迁移」，0031）
9. 灌演示数据：**待远程导入工具完成后补命令；目前在此停止，不部署空库**。`DEMO_DATA=true` 只控制页面标识，不会自动填充 D1。
10. `npm run cf:deploy`（Windows 上构建要用 4a 节的两个补丁，`npm install` 会自动打上）
11. 打开 `https://zhaogong-demo.zhaogong.workers.dev`：首页、`/jobs`、一个职位页、`/login`（应该是「暂时不能登录」）、英文页、`/admin` 是 404

**部署前在本机先过一遍（最终集成验收）：** `npm run cf:build`，量 `.open-next/worker.js` 打包压缩后的大小（Workers 免费方案上限 3 MiB），再 `npm run cf:preview` 用本地 D1 打开第 11 步那几页。

## 4a. 上线前必须过 cf:build（#332）

**部署前，`npm run cf:build` 和 `npx wrangler deploy --dry-run` 在本机都要过。** 10-20 的构建曾失败，报错见第 6 节「本机构建结果」；两个修复补丁已集成，最终版本尚待重跑，原因是 OpenNext 的已知问题 [#1400](https://github.com/opennextjs/opennextjs-cloudflare/issues/1400)。导师 10-20 03:1x 定的做法：

1. **先等 OpenNext 发布修复**（[PR #1430](https://github.com/opennextjs/opennextjs-cloudflare/pull/1430)、[PR #1445](https://github.com/opennextjs/opennextjs-cloudflare/pull/1445)），把 `@opennextjs/cloudflare` 升到那个版本，在本机重新构建、预览一遍（第 6 节）。
2. **上线前还没修好的话，打补丁：**
   - 要改的文件：`node_modules/@opennextjs/cloudflare/dist/cli/build/open-next/bundle-node-middleware.js`（1.20.10 里在第 167 行）。
   - 原来这一行检查的是 app 构建输出里有没有 `@opentelemetry/api` 这个目录：
     ```js
     const hasOpentelemetry = existsSync(path.join(options.appBuildOutputPath, "node_modules", "@opentelemetry", "api"));
     ```
   - 改成检查拷给中间件的 node_modules 里有没有它的 ESM 版（照 #1400 里报告人的写法；没有的话就换成 Next 自带的那一份）：
     ```js
     const hasOpentelemetry = existsSync(path.join(middlewareDir, "node_modules", "@opentelemetry", "api", "build", "esm", "index.js"));
     ```
     `middlewareDir` 在同一个函数前面（第 141 行）已经定义好了。
   - 让 `npm ci` 以后也带着这个补丁：加开发依赖 `patch-package`，`package.json` 加 `"postinstall": "patch-package"`。改好文件后跑 `npx patch-package @opennextjs/cloudflare`，生成 `patches/@opennextjs+cloudflare+1.20.10.patch` 并提交。补丁里写死了版本号，**升级 OpenNext 时要删掉补丁，重新确认还要不要**。
   - **试过（2026-10-20 03:10，见第 6 节）：打上补丁后，中间件那一步过了。** 接着在 Windows 上卡在建符号链接，要在 Linux 上构建。
3. **10-20 23:2x 起走第 2 条（上游还没修：1.20.12 是最新版，#1400、PR #1430、#1445 都还开着）。** 补丁在仓库里，`npm install` / `npm ci` 时 `postinstall` 自动打上：
   - `patches/@opennextjs+cloudflare+1.20.10.patch`：上面那一行。
   - `patches/@opennextjs+aws+4.1.9.patch`：`copyTracedFiles.js` 建符号链接遇到 `EPERM`（Windows 没开开发者模式）时，改成把链接指向的内容拷过去。Linux 上（Workers Builds）不会走到这里。这样 Windows 本机也能构建和预览，不用改系统设置。
   - 升级 `@opennextjs/cloudflare` 或 `@opennextjs/aws` 时，先删掉对应的补丁，重新确认还要不要。

## 5. 回滚

- **代码：** Cloudflare 后台 Worker 的 Deployments 里选上一个版本回退，或者 `npx wrangler rollback`。回退之后，代码和库结构要对得上，见下一条。
- **数据库：** 迁移只往前走，没有写「往回」的迁移。所以：
  - 每次迁移之前先备份：`npx wrangler d1 export zhaogong --remote --output=zhaogong-<日期>.sql`（放在本机安全的地方，**里面有用户数据**，不进仓库）。D1 自己也能回到 30 天内的某个时间点（Time Travel，`npx wrangler d1 time-travel`）。
  - 迁移最好写成「只加不删」（加表、加可以为空的列），这样旧代码在新库上也能跑，代码回退就不用动库。
  - 真要回到迁移以前的库：用 Time Travel 回到迁移前的时间点，或者建一个新库、用备份 `npx wrangler d1 execute <新库> --remote --file=zhaogong-<日期>.sql` 灌回去，再把绑定指过去。
- **演示数据弄乱了：** 演示站可以清空重灌；正式站绝不能这样做。

## 6. 本机构建和预览

```sh
npm ci
npm run check
npm run cf:build
npm run cf:preview   # 本地 workerd，8704
```

PowerShell 先设 `$env:NEXT_TELEMETRY_DISABLED = '1'`、`$env:WRANGLER_SEND_METRICS = 'false'`。在本机跑 `cf:build` 算 check 级别的活：要拿找工的 e2e 锁，空闲内存 4.5 GB 以上，按 GPU FIFO 队列拿锁后再跑。

`cf:preview` 使用 Wrangler 模拟的本机 D1；先按末节迁移、seed，并确保预览使用相同的持久化目录。不要设置 `DATABASE_URL` 或 `DATABASE_AUTH_TOKEN`，否则会绕过 D1。`.dev.vars`（已忽略）可以放本机预览专用的 `AUTH_SECRET` 和 `DEMO_DATA=true`。生产预览未配置邮件时只验收浏览与禁止登录；完整登录/聊天的 Playwright 验收使用 `npm run e2e:build` 的测试构建，见 `CLAUDE.md`，不能把开发辅助接口部署到线上。

### `@libsql/client` 在 Worker 里

- `@libsql/client` 0.18.0 的 package.json：`import` 条件 `workerd` → `./lib-esm/web.js`。OpenNext 用 esbuild 按 workerd 的条件打包，会拿到 web 版。
- web 版只认 `libsql://`、`https://`、`wss://`，**不认 `file:`**。这一节记的是换 D1 以前的情况（ADR 0029）；换过去以后线上不再用 `@libsql/client`。
- `src/db/client.ts` 引入了 `node:fs` 的 `mkdirSync`，只有在 `file:` 库时才调用；线上不会走到。
- 迁移见第 3 节：只在本机对线上库跑（#329）。

### 本机构建结果（2026-10-20 03:02，`a/deploy-prep` `87b4cea`，Windows，拿着 e2e 锁跑）

**没过。** `next build` 本身成功了（编译 3.6 秒，106 个页面），OpenNext 打包 `proxy.ts`（Node.js 中间件）这一步报错：

```
.open-next/middleware/node_modules/next/dist/server/lib/trace/tracer.js:55:18: ERROR: Could not resolve "@opentelemetry/api"
```

- **原因：** 是 OpenNext 已知的问题 [opennextjs-cloudflare#1400](https://github.com/opennextjs/opennextjs-cloudflare/issues/1400)。项目的 `node_modules` 顶层装了 `@opentelemetry/api`（我们这里是 1.9.1，由 `@anthropic-ai/sdk`、`drizzle-orm`、`next` 带进来）时，OpenNext 打包中间件就不会把它换成 Next 自带的那一份，可是拷给中间件的 node_modules 里又只有它的 CJS 版，esbuild 找的是 ESM 版，于是找不到。
- **为什么 10-14 能构建：** `src/proxy.ts` 是 10-16 才加的（#79），10-14 那次没有 Node 中间件。
- **修复还没发布：** [PR #1430](https://github.com/opennextjs/opennextjs-cloudflare/pull/1430)（改成先照常解析，找不到再退回 Next 自带的那份）、[PR #1445](https://github.com/opennextjs/opennextjs-cloudflare/pull/1445)，查的时候都还没合并。构建日志里还有一句「Node.js middleware support is experimental in cloudflare」。
- **可选的路（要导师定）：**
  1. 等 OpenNext 发布带这个修复的版本，再升级（升级前照第 6 节先在本机构建、预览一遍）。
  2. 先用 patch-package 给 `@opennextjs/cloudflare` 打上 #1400 里那个补丁：要多加一个开发依赖，每次升级 OpenNext 都要重新看一遍补丁还对不对。
  3. 看 `proxy.ts` 能不能不当成 Node 中间件跑：要先查它用到了哪些 Node API、Next 16 还支不支持 edge 运行时，改动最大。
- `wrangler deploy --dry-run` 和打包里用的是不是 libsql 的 web 版，要等构建过了才能查，这次没跑到。

日志在仓库外：`D:/dev/zg-scratch/a-d26/cfbuild/run.log`、`build.log`。

**第二次（2026-10-20 03:09，`e88ee35`，补丁只在这一次打上，跑完就恢复了原文件，没有提交）：**

- `npm run check` 过了（单测 1249 条）。
- 打上第 4a 节的补丁后，`Bundling Node.js middleware...` **过了**，补丁管用。
- 接着在 `Bundling cache assets...` 后面报 `EPERM: operation not permitted, symlink`：OpenNext 要在 `.open-next/server-functions/default/.next/node_modules/` 下面给 `@libsql/client` 建一个符号链接。Windows 默认不让普通用户建符号链接（要开发者模式或者管理员权限，这是系统设置，没去改）。10-14 那次在 Windows 上能构建，是因为那时还没有 `@libsql/client` 这个外部包。
- **结论：** 上线用的构建要放在 **Linux** 上：Cloudflare 的 Workers Builds，或者 WSL / Linux 机器，在那边重新 `npm ci`，别拷 Windows 的 node_modules。到时（升级了 OpenNext，或者打了补丁）照第 4a 节在 Linux 上跑 `cf:build` 和 dry-run，再确认包里用的是 libsql 的 web 版（`grep -rl "lib-esm/web" .open-next/server-functions`）。
- 日志：`D:/dev/zg-scratch/a-d26/deploygate/run.log`、`check.log`、`build.log`。

## 7. 参考

- [Cloudflare：Next.js / OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[process.env](https://developers.cloudflare.com/changelog/post/2025-03-11-process-env-support/)、[限制](https://developers.cloudflare.com/workers/platform/limits/)
- [OpenNext Cloudflare 入门](https://opennext.js.org/cloudflare/get-started)
- Cloudflare D1：[说明](https://developers.cloudflare.com/d1/)、[Wrangler 的 D1 命令](https://developers.cloudflare.com/workers/wrangler/commands/#d1)、[位置提示](https://developers.cloudflare.com/d1/configuration/data-location/)、[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

### 本机 D1 初始化与维护（2026-10-22 已实测）

不用账号即可在本机执行，所有命令只操作 Wrangler 的本机 D1，不会访问远程数据库：

```powershell
$env:EXTERNAL_JOBS = 'demo'
npm run db:seed -- --d1-local
npm run admin:grant -- moderator@example.com --d1-local
```

`--d1-local` 会先用 Wrangler 应用 `drizzle/` 全部迁移，再打开本地绑定；重复 seed 不覆盖已有数据。本机授予审核员不会开启线上账号。未知、重复或不适用的参数会在开库前拒绝；`--d1-remote` 当前明确拒绝，不能用于线上初始化。

隔离验收数据时，两条命令都追加 `--persist-to D:/dev/zg-scratch/d1/integration-local`。该目录与预览命令的 `--persist-to` 相同；CLI 会自动处理平台代理多出的 `v3` 子目录。`npm run db:reset` 只重置本机 libSQL 文件，不重置 D1。

本地维护命令还支持 `db:migrate`、`admin:revoke` 和 `import:external` 的 `--d1-local`。这里尚未提供远程数据导入命令，不要把本地命令当成线上已初始化。Worker 配置开启日志和 traces，默认抽样 10%。
