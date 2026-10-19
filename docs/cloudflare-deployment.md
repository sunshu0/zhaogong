# Cloudflare 部署清单

用户 10-20 01:2x 定的方向：**放在境外，跑在 Cloudflare Workers，数据库放在悉尼**。导师先定了 Turso，因为现在的驱动就是 libSQL（`@libsql/client`）。这份文件是一份照着做的清单。**到目前为止没有部署，也没有注册任何账号。** 标着「用户做」的步骤要以公司名义注册或付费（落地主体见 Progress「用户决定 10-20 01:2x」），别人不能代做。

10-14 那次发布的是只读模拟数据的前端演示（Worker `zhaogong-demo`，`zhaogong-demo.zhaogong.workers.dev`），那时还没有数据库。下面写的是有数据库以后的做法。

## 0. 先决定的事

- **落地主体和账号（用户做）：** Cloudflare 账号、Turso 账号、域名，都以公司名义注册。
- **登录验证码的邮件服务（Issue #16，还没定）：** 生产环境没有邮件服务就发不出验证码（`src/lib/auth/delivery.ts`：`canSendCodes()` 为假时直接拒绝），也就**没人能登录**。正式开放前一定要定下来。只放演示的话，可以先不开放登录，但所有要登录的功能就都用不了。
- **Clarity：** 项目 ID 和同意提示（C 的 #313）合并后才用得上，见第 2 节。

## 1. 版本和配置

- Node.js 24（`.node-version`，24.19.0）；Next.js 16.3.8；`@opennextjs/cloudflare` 1.20.10；Wrangler 4.150.0；`@libsql/client` 0.18.0；`drizzle-orm` 和 drizzle-kit 照 `package.json`。
- `wrangler.jsonc`：Worker `zhaogong-demo`，`compatibility_date` 2026-09-01，`nodejs_compat` 和 `global_fetch_strictly_public`。日期在 2025-04-01 之后，开了 `nodejs_compat` 就会自动把变量和密钥放进 `process.env`，代码不用改（[Cloudflare 说明](https://developers.cloudflare.com/changelog/post/2025-03-11-process-env-support/)）。正式上线时 Worker 的名字可以改：`name` 和 `services[0].service` 要一起改。
- `open-next.config.ts`：静态资源增量缓存，`enableCacheInterception: false`（PPR 要靠 Next 自己续上动态内容）。
- Next 16.4.0 在本地 workerd 里会报 `Unexpected loadManifest(/.next/server/preview-props.json)`，所以停在 16.3.8。升级 Next 或 OpenNext 之前，先照第 6 节在本机构建和预览一遍。

## 2. 要设的变量和密钥

都是在 Worker 运行时读的（`process.env`），只有 `NEXT_PUBLIC_*` 和下表标「构建时」的，要在构建时就设好。密钥用 `npx wrangler secret put <名字>`（[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)），不写进代码、配置文件和这份文档。

| 名字 | 类型 | 必须吗 | 做什么、不设会怎样 | 代码 |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | 变量 | **必须** | Turso 库的地址，`libsql://<库名>-<组织>.turso.io`。不设就去找本地文件 `file:./data/zhaogong.db`，Worker 里没有 | `src/db/client.ts` |
| `DATABASE_AUTH_TOKEN` | 密钥 | **必须** | Turso 的库令牌 | `src/db/client.ts` |
| `AUTH_SECRET` | 密钥 | **必须** | 验证码的 HMAC 密钥。生产环境没有就直接报错（`src/lib/auth/config.ts`） | `src/lib/auth/config.ts` |
| `ZG_EVENTS_SECRET` | 密钥 | 要统计就必须 | 漏斗事件里访客号的 HMAC 密钥（ADR 0025）。生产环境不设就不记事件，日志里会说一次 | `src/lib/events/visitor-key.ts` |
| `NEXT_PUBLIC_CLARITY_ID` | 变量，**构建时** | 要 Clarity 就要 | Clarity 项目 ID，构建时写进浏览器的 JS。**还没在 main 上**（C 的 #313） | （#313） |
| `SITE_URL` | 变量 | 用自己的域名时要 | 绝对链接、robots、sitemap 的地址；不设就照请求的 host | `src/lib/site.ts`、`src/app/robots.ts` |
| `DEMO_DATA` | 变量 | 演示站设 `true` | 生产构建默认 false。设成 true 时，空库在第一次用的时候灌演示数据，首页的数字旁边会标「演示数据」 | `src/db/ready.ts`、`src/config/landing.ts` |
| `ADMIN_ENABLED` | 变量，**构建时和运行时都要** | 正式站别设 | 设成 `1` 才有 `/admin`。它没有审核员登录，正式站不要开 | `src/app/[lang]/admin/enabled.ts` |
| `ANTHROPIC_API_KEY` | 密钥 | 要「对话发布」用模型就要 | 生产环境有它就用 Claude，没有就说这个功能现在用不了 | `src/lib/ai-post/model/` |
| `AI_POST_MODEL` | 变量 | 可以不设 | 换模型；不设用代码里的默认值 | `src/lib/ai-post/model/index.ts` |
| `AI_POST_BASE_URL` | 变量 | 可以不设 | 默认 `https://api.anthropic.com` | `src/lib/ai-post/model/client.ts` |
| `TAKEDOWN_EMAIL` | 变量 | 建议设 | 外部职位页下面「公司要求下架」的联系邮箱；不设就不显示 | `src/config/external-companies.ts` |
| `EXTERNAL_JOBS` | 变量 | 生产环境别设 | `real` 会让空的演示库在后台去公司网站导入真实职位；生产环境默认不导入 | `src/db/ready.ts` |
| `NEXTJS_ENV` | 变量 | 已经在 `wrangler.jsonc` | `production` | `wrangler.jsonc` |

只在开发和测试里用的：`ZG_E2E`、`E2E_PORT`、`AI_POST_FAKE`、`AI_POST_LIVE`、`NEXT_PRIVATE_STANDALONE`，线上不要设。

这张表是 2026-10-20 在 main `db689a6` 上 grep `process.env.*` 和 `env.*` 整理的。加了新变量要回来补这张表。

## 3. 线上数据库：Turso，悉尼区

以下命令用 Turso CLI（[说明](https://docs.turso.tech/cli/introduction)）。**账号由公司注册（用户做）**，命令由有权限的人在本机跑。

1. **（用户做）** 用公司名义注册 Turso，在本机 `turso auth login`。
2. 查悉尼区的代码：`turso db locations`。区域是设在**组**上的，不是设在库上（[group create](https://docs.turso.tech/cli/group/create)）。
3. 建组和库：
   ```sh
   turso group create zhaogong --location <悉尼区的代码>
   turso db create zhaogong --group zhaogong
   ```
   （[db create](https://docs.turso.tech/cli/db/create)；免费方案只有一个组的话，可以直接用默认组，组建在悉尼就行。）
4. 地址和令牌：
   ```sh
   turso db show zhaogong --url          # 就是 DATABASE_URL
   turso db tokens create zhaogong        # 就是 DATABASE_AUTH_TOKEN
   ```
   令牌默认不过期，可以加 `--expiration`（[tokens](https://docs.turso.tech/cli/group/tokens/create)）。令牌只放进 Worker 的密钥和本机临时的环境变量里，**不写进任何文件**。

### 迁移（每次部署前）

Worker 里没有 `drizzle/` 文件夹，所以远程库**不会**在第一次用的时候自动迁移（#329：`migratesOnFirstUse()` 只对本地文件库和内存库为真）。每次有新的迁移，都要在部署 Worker **之前**，在本机对线上库跑一次：

```sh
DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" npm run db:migrate
```

PowerShell：先 `$env:DATABASE_URL = '…'`、`$env:DATABASE_AUTH_TOKEN = '…'`，再 `npm run db:migrate`，跑完把这两个变量删掉。

### 演示数据

- **演示站：** 照上面迁移完，再跑 `npm run db:seed`（同样带那两个变量）：库是空的就灌入演示数据。也可以 Worker 设 `DEMO_DATA=true`，空库在第一次用的时候灌入。建议用命令灌，第一次打开页面就不用等。
- **正式站：** 不灌演示数据，`DEMO_DATA` 不设。审核员账号用 `npm run db:migrate` 后的 `tsx src/db/cli.ts admin:grant <邮箱>` 加。

## 4. 部署（Cloudflare）

1. **（用户做）** 用公司名义注册 Cloudflare，在本机 `npx wrangler login`。
2. 设密钥（第 2 节）：`npx wrangler secret put DATABASE_AUTH_TOKEN`、`AUTH_SECRET`、`ZG_EVENTS_SECRET`、`ANTHROPIC_API_KEY`（要的话）。变量（`DATABASE_URL`、`SITE_URL`、`DEMO_DATA` 等）写进 `wrangler.jsonc` 的 `vars`，或者在 Cloudflare 后台设。
3. 对线上库迁移（第 3 节）。
4. 本机预检：`npm run check`，再 `npm run cf:dry-run`（构建加上传前的检查，不上传）。
5. 部署：`npm run cf:deploy`。
6. 验收：首页、职位列表和筛选、职位页、登录（要有邮件服务）、发布职位、聊天、英文页；`/admin` 应该是 404（`ADMIN_ENABLED` 没设）。

以后改用 Workers Builds 自动部署的话：构建命令 `npm run check && npm run cf:build`，部署命令 `npx opennextjs-cloudflare deploy`。构建变量要有 `NODE_VERSION=24.19.0`、`NEXT_TELEMETRY_DISABLED=1`，以及 `NEXT_PUBLIC_CLARITY_ID`（构建时用）（[说明](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)）。

## 5. 回滚

- **代码：** Cloudflare 后台 Worker 的 Deployments 里选上一个版本回退，或者 `npx wrangler rollback`。回退之后，代码和库结构要对得上，见下一条。
- **数据库：** 迁移只往前走，没有写「往回」的迁移。所以：
  - 每次迁移之前先备份：`turso db shell zhaogong .dump > zhaogong-<日期>.sql`（放在本机安全的地方，**里面有用户数据**，不进仓库）。
  - 迁移最好写成「只加不删」（加表、加可以为空的列），这样旧代码在新库上也能跑，代码回退就不用动库。
  - 真要回到迁移以前的库：用备份建一个新库（`turso db create zhaogong-restore --from-dump zhaogong-<日期>.sql`，参数照 [db create](https://docs.turso.tech/cli/db/create)），把 Worker 的 `DATABASE_URL` 换过去，再回退代码。
- **演示数据弄乱了：** 演示站可以清空重灌；正式站绝不能这样做。

## 6. 本机构建和预览

```sh
npm ci
npm run check
npm run cf:build
npm run cf:preview   # 本地 workerd，8704
```

PowerShell 先设 `$env:NEXT_TELEMETRY_DISABLED = '1'`、`$env:WRANGLER_SEND_METRICS = 'false'`。在本机跑 `cf:build` 算 check 级别的活：要拿找工的 e2e 锁，空闲内存 4 GB 以上，GPU 锁没人用的时候再跑。

`cf:preview` 跑起来以后，`E2E_PORT=8704 npm run test:e2e` 就是在真正的 workerd 里测。预览要连远程库的话，在 `.dev.vars` 里放 `DATABASE_URL`、`DATABASE_AUTH_TOKEN`（`.gitignore` 已经忽略 `.dev.vars*`，不会进仓库）；不设的话预览会去找本地文件库，workerd 里打不开。

### `@libsql/client` 在 Worker 里

- `@libsql/client` 0.18.0 的 package.json：`import` 条件 `workerd` → `./lib-esm/web.js`。OpenNext 用 esbuild 按 workerd 的条件打包，会拿到 web 版。
- web 版只认 `libsql://`、`https://`、`wss://`，**不认 `file:`**。线上用 Turso，本来就不用 `file:`。
- `src/db/client.ts` 引入了 `node:fs` 的 `mkdirSync`，只有在 `file:` 库时才调用；线上不会走到。
- 迁移见第 3 节：只在本机对线上库跑（#329）。

### 本机构建结果

（2026-10-20：等 GPU 锁空出来就照上面的条件跑一次，结果写在这里。）

## 7. 参考

- [Cloudflare：Next.js / OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)、[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[process.env](https://developers.cloudflare.com/changelog/post/2025-03-11-process-env-support/)、[限制](https://developers.cloudflare.com/workers/platform/limits/)
- [OpenNext Cloudflare 入门](https://opennext.js.org/cloudflare/get-started)
- Turso：[CLI](https://docs.turso.tech/cli/introduction)、[group create](https://docs.turso.tech/cli/group/create)、[db create](https://docs.turso.tech/cli/db/create)、[tokens](https://docs.turso.tech/cli/group/tokens/create)
