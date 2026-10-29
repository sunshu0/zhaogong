# Cloudflare 部署清单

用户 10-20 定的：**放在境外，跑在 Cloudflare Workers，数据库用 Cloudflare D1**（23:4x 从 Turso 改过来，理由和代价见 ADR 0029）。**集成分支已支持 D1**：驱动切换、交互式事务改写和本机维护命令已完成（ADR 0031），最终构建和浏览器验收尚未完成，未合并进 main。演示数据和首位审核员的离线 SQL 工具已实现并通过本机 D1 验证；最终构建、远程环境验证和登录邮件服务仍未完成。这份清单记录上线准备；本轮没有部署或注册账号。 标着「用户做」的步骤要以公司名义注册或付费（落地主体见 Progress「用户决定 10-20 01:2x」），别人不能代做。

10-14 那次发布的是只读模拟数据的前端演示（Worker `zhaogong-demo`，`zhaogong-demo.zhaogong.workers.dev`），那时还没有数据库。下面写的是有数据库以后的做法。

## 0. 先决定的事

- **落地主体和账号（用户做）：** Cloudflare 账号（Worker、D1、R2 都在里面）和域名，都以公司名义注册。
- **登录验证码的邮件服务（#16，用户 10-23 定了 Amazon SES，ADR 0032）：** 代码已接好（`src/lib/auth/ses.ts`）。第 2 节的四个 SES 设置都有了才发信；少一个，生产环境就发不出验证码（`canSendCodes()` 为假时直接拒绝），也就**没人能登录**。账号、发信域名、离开沙盒由用户做，见第 4 节第 2b 步。
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
| `PUSH_VAPID_PUBLIC_KEY` | 服务器变量 | 要网页推送时设 | 匹配P-256密钥对的原始公钥，base64url；校验成功后才交给浏览器 | `src/lib/push/web-push.ts` |
| `PUSH_VAPID_PRIVATE_KEY` | 密钥 | 要网页推送时设 | 同一P-256密钥对的私钥标量，base64url；不放入源码或NEXT_PUBLIC变量；未配置时如实显示暂未开放 | `src/lib/push/web-push.ts` |
| `PUSH_VAPID_SUBJECT` | 服务器变量 | 要网页推送时设 | 运营方真实可联系的mailto或HTTPS地址；三个值及密钥对均有效才开放主动启用，迁移/受控验证见docs/web-push.md | `src/lib/push/web-push.ts` |
| `ZG_EVENTS_SECRET` | 密钥 | 要统计就必须 | 漏斗事件里访客号的 HMAC 密钥（ADR 0025）。生产环境不设就不记事件，日志里会说一次 | `src/lib/events/visitor-key.ts` |
| `NEXT_PUBLIC_CLARITY_ID` | 变量，**构建时** | 要 Clarity 就要 | Clarity 项目 ID，构建时写进浏览器的 JS。已集成同意提示和敏感页面屏蔽`src/components/analytics/Analytics.tsx` | `src/components/analytics/Analytics.tsx` |
| `SITE_URL` | 变量 | 用自己的域名时要 | 绝对链接、robots、sitemap 的地址；不设就照请求的 host | `src/lib/site.ts`、`src/app/robots.ts` |
| `DEMO_DATA` | 变量 | 演示站设 `true` | 生产构建默认 false。设成 true 时，空库在第一次用的时候灌演示数据，首页的数字旁边会标「演示数据」 | `src/db/ready.ts`、`src/config/landing.ts` |
| `ADMIN_ENABLED` | 变量，**构建时和运行时都要** | 演示站不设 | 设成 `1` 才有 `/admin`；还必须登录并具备审核员权限（`requireModerator()`）。正式站启用前先初始化审核员并验收登录 | `src/app/[lang]/admin/enabled.ts` |
| `ZHAOGONG_ADMIN_EMAILS` | 变量（运行时） | 开审核后台时设 | 管理员的邮箱，逗号分隔（ADR 0043）。管理员也是审核员，只有管理员能在审核后台添加、移除审核员；网页上改不了。用专门的邮箱（没有求职、招聘数据的）。不设的话网页上没人能增删审核员，只能用 `npm run admin:grant` | `src/db/admins.ts` |
| `ANTHROPIC_API_KEY` | 密钥 | 要「对话发布」用模型就要 | 生产环境有它就用 Claude，没有就说这个功能现在用不了 | `src/lib/ai-post/model/` |
| `AI_POST_MODEL` | 变量 | 可以不设 | 换模型；不设用代码里的默认值 | `src/lib/ai-post/model/index.ts` |
| `AI_POST_BASE_URL` | 变量 | 可以不设 | 默认 `https://api.anthropic.com` | `src/lib/ai-post/model/client.ts` |
| `SES_REGION` | 变量 | 要登录就必须 | Amazon SES 的区域，`wrangler.jsonc` 里是 `ap-southeast-2`（悉尼，ADR 0032）。要和发信域名验证的区域一致 | `src/lib/auth/ses.ts` |
| `MAIL_FROM` | 变量 | 要登录就必须 | 验证码邮件的发件人，必须在 SES 验证过的域名上，比如 `找工 <no-reply@你的域名>` | `src/lib/auth/ses.ts` |
| `SES_ACCESS_KEY_ID` | 密钥 | 要登录就必须 | 只能发信的 IAM 用户的访问密钥 ID（权限只给 `ses:SendEmail`） | `src/lib/auth/ses.ts` |
| `SES_SECRET_ACCESS_KEY` | 密钥 | 要登录就必须 | 上面那个访问密钥的私钥。四个 SES 设置少一个，生产环境就不发信、不让登录 | `src/lib/auth/ses.ts` |
| `TAKEDOWN_EMAIL` | 变量 | 建议设 | 外部职位页下面「公司要求下架」的联系邮箱；不设就不显示 | `src/config/external-companies.ts` |
| `EXTERNAL_JOBS` | 变量 | 生产环境别设 | `real` 会让空的演示库在后台去公司网站导入真实职位；生产环境默认不导入 | `src/db/ready.ts` |
| `NEXTJS_ENV` | 变量 | 已经在 `wrangler.jsonc` | `production` | `wrangler.jsonc` |
| `EVIDENCE_BUCKET` | **R2 绑定** | **必须** | 举报截图存放的 R2 桶（ADR 0027）。Worker 里没绑就不收截图（举报会报错），见第 4 节第 2a 步 | `src/db/evidence-store.ts` |
| `PHOTO_BUCKET` | **R2 绑定** | **必须** | 企业门店照片存放的 R2 桶（ADR 0052），和举报截图分开。Worker 里没绑就不收门店照片（上传会报错），见第 4 节第 2c 步 | `src/db/photo-store.ts` |
| `ZG_PHOTO_DIR` | 变量 | 本机可以不设 | 不在 Cloudflare 上时门店照片放的文件夹，默认 `data/uploads/company-photos`（`data/` 不进 git） | `src/db/photo-store.ts` |
| `ZG_EVIDENCE_DIR` | 变量 | 本机可以不设 | 不在 Cloudflare 上时截图放的文件夹，默认 `data/uploads/report-evidence`（`data/` 不进 git） | `src/db/evidence-store.ts` |

只在开发和测试里用的：`ZG_E2E`、`E2E_PORT`、`AI_POST_FAKE`、`AI_POST_LIVE`、`NEXT_PRIVATE_STANDALONE`，线上不要设。

这张表已按 2026-10-22 集成分支核对。新增变量或绑定需更新此表，`scripts/docs-drift.test.mjs` 会检查遗漏。

## 3. 线上数据库：Cloudflare D1

**先完成集成分支的 check、Cloudflare 构建和本地 D1 浏览器验收，再合并部署。** D1 业务改写和本机命令已完成，演示数据及第一位审核员均可通过下方离线 SQL 工具准备；本轮只做本机验证，不执行远程操作。命令用 Wrangler（[D1 说明](https://developers.cloudflare.com/d1/)），由有公司账号权限的人在本机跑。

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

- **演示站：** 必须在开放站点前用命令灌数据；D1 不会在首次请求时 seed，单设 `DEMO_DATA=true` 不会填库。本机命令见末节，远程演示数据通过下一小节的 SQL 文件导入；本轮只验证了本机 D1，未写入远程库。
- **正式站：** 不灌演示数据，`DEMO_DATA` 不设。`admin:grant` 支持本机 D1（`--d1-local`）；正式站第一位审核员通过 `admin:grant-sql` 生成文件，再由账号持有人用 Wrangler 导入，见末节。正式站启用后台前需完成这一步。
- **查库：** D1 没有对外的数据库连接。国内同事查数据在 Cloudflare 后台，或者 `npx wrangler d1 execute zhaogong --remote --command "<SQL>"`；照 ADR 0026 的精神，只查需要的。

## 4. 部署（Cloudflare）

1. **（用户做）** 用公司名义注册 Cloudflare，在本机 `npx wrangler login`。
2. 设密钥（第 2 节）：`npx wrangler secret put AUTH_SECRET`、`ZG_EVENTS_SECRET`、`ANTHROPIC_API_KEY`（要的话）。变量（`SITE_URL`、`DEMO_DATA` 等）写进 `wrangler.jsonc` 的 `vars`，或者在 Cloudflare 后台设。
2a. **（用户做）举报截图的 R2 桶**（ADR 0027）：以公司名义在 Cloudflare 开 R2，建一个桶（比如 `zhaogong-report-evidence`，位置提示选大洋洲 `oc`，和 D1 一样离用户近；Wrangler 4.150 的 `r2 bucket create --location` 可选 weur、eeur、apac、wnam、enam、oc），**不要开公开访问**，也不要绑自定义域名；在 `wrangler.jsonc` 加 `"r2_buckets": [{ "binding": "EVIDENCE_BUCKET", "bucket_name": "zhaogong-report-evidence" }]`。截图只通过 `/api/report-evidence/[id]` 给审核员看。处理完 180 天后和删号时，代码会把文件一起删掉。
2c. **（用户做）门店照片的 R2 桶**（ADR 0052）：和 2a 一样，再建一个桶 `zhaogong-company-photos`（位置提示 `oc`），**不要开公开访问**，也不要绑自定义域名；`wrangler.jsonc` 的 `r2_buckets` 里已经写好 `PHOTO_BUCKET` 这一项，桶名不同就改那里。照片只通过 `/api/company-photos/[id]` 发出去：审核通过、企业没被封才给看（浏览器最多缓存 10 分钟），待审的只给本企业和审核员。退回、删除、企业被删时，代码会把文件一起删掉。
2b. **（用户做）登录验证码的邮件：Amazon SES（ADR 0032）。** 分步说明另给用户。要点：
   - 以公司名义开 AWS 账号，在 SES 悉尼区（`ap-southeast-2`）验证发信域名：3 条 DKIM CNAME；自定义 MAIL FROM 子域（MX 加 SPF TXT），让 SPF 对齐；`_dmarc` TXT 先用 `p=none`。
   - 申请离开沙盒（production access）。在沙盒里只能发给验证过的地址。
   - **开启账号级 suppression list**（退信和投诉自动不再发）。SES 的退信、投诉回调（SNS）现在不做，见 ADR 0032。
   - 建一个只有 `ses:SendEmail` 权限的 IAM 用户，访问密钥用 `npx wrangler secret put SES_ACCESS_KEY_ID`、`SES_SECRET_ACCESS_KEY` 放进 Worker；`MAIL_FROM` 写进 `wrangler.jsonc` 的 `vars`。
   - 上线前用真实的 QQ、163、Gmail、Outlook 邮箱各收几次验证码，看收没收到、进没进垃圾箱。
3. 对线上 D1 库迁移（第 3 节，ADR 0031 的代码合并后）。
4. 本机预检：`npm run check`，再 `npm run cf:dry-run`（构建加上传前的检查，不上传）。**最终版本尚未完成这一步，先看第 4a 节。**
5. 部署：`npm run cf:deploy`。
6. 验收：首页、职位列表和筛选、职位页、登录（要有第 2b 步的 SES）、发布职位、聊天、英文页；`/admin` 应该是 404（`ADMIN_ENABLED` 没设）。

### 4b. Workers Builds：只盯 `production` 分支（用户 10-27 02:5x 定，先用于演示站）

Cloudflare 从 GitHub 拉代码、在它的 Linux 机器上构建和部署（[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)），Windows 上建符号链接的问题（第 4a 节）就不用管了。`main` 照旧开发、合并；用户说「发布」时，导师把 `main` 推到 `production`，推上去就自动构建部署。在 Worker 的 **Settings > Build** 里设（[设置说明](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)）：

| 设置 | 值 | 说明 |
| --- | --- | --- |
| Git 仓库 | `open-alternative-app/zhaogong` | 用户在 Cloudflare 里授权 GitHub 应用读这个私有仓库 |
| **Branch control** 的生产分支 | `production` | 默认是 `main`，要改 |
| **Enable Preview Builds** | **不勾** | 在 Settings > Build > Branch control。勾着的话推别的分支也会构建（[说明](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)）；我们的分支不该自动上线 |
| Build command | `npm run cf:build` | 只构建，不重跑测试：门槛在合并进 `main` 前已跑过整套；Workers Builds 也没法等 GitHub 上的检查 |
| Deploy command | `npx wrangler d1 migrations apply zhaogong-demo --remote && npx opennextjs-cloudflare deploy` | 先迁移、再上新代码。迁移失败就停，不上新代码。`migrations apply` 对已应用的迁移不重复跑 |
| API token | 用户自己建的令牌（见下） | 自动生成的令牌没有 D1 权限，上面那条迁移会被拒 |
| Root directory | 不填（仓库根目录） | |
| 构建变量 | `NODE_VERSION=24.19.0`、`NEXT_TELEMETRY_DISABLED=1` | 构建变量只在构建时有，运行时读不到。运行时的变量写在 `wrangler.jsonc` 的 `vars`，密钥用 `wrangler secret put` |

- **令牌：** Workers Builds 自动生成的令牌权限是 Account Settings 读、Workers Scripts / KV / R2 写、Workers Routes 写、User Details 和 Memberships 读，**没有 D1**（[设置说明「API token」](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token)）。所以由用户在 **My Profile > API Tokens** 建一个用户令牌：在那几项之外加 **Account · D1 · Edit**，在 Workers Builds 里选它。现在只支持用户令牌（同一页）。
- **不想给构建令牌 D1 权限的退路：** 部署命令只留 `npx opennextjs-cloudflare deploy`。这样每次发布前，只要 `drizzle/` 里有新迁移，用户都要先在本机跑 `npx wrangler d1 migrations apply zhaogong-demo --remote`；忘了的话，新代码会在旧库结构上跑。
- **迁移只加不删**（第 5 节）：部署过程中旧代码还会在新库结构上跑一会儿。
- 运行时的 `vars` 每次部署都照 `wrangler.jsonc` 覆盖一遍；在后台改了的变量，下次部署会被冲掉，所以只在文件里改。
- 构建出错、部署失败，在 Worker 的 **Deployments / Builds** 里看日志；回滚见第 5 节。

## 3a. 演示站（用户 10-20 23:1x 定：先更新这个，不正式上线）

**`https://zhaogongnz.com`**（用户 10-27 02:5x 定；域名在用户的 Cloudflare 账号里，DNS 也在那里）：完整版代码，灌演示数据，用 Workers Builds 从 `production` 分支自动部署（第 4b 节）。演示站和正式站一样用 Cloudflare D1（ADR 0029），但库是单独的 `zhaogong-demo`。Worker 名照旧 `zhaogong-demo`，`zhaogong-demo.<账号子域>.workers.dev` 也还能打开。

`wrangler.jsonc` 已经写好：自定义域名（`routes` 里 `custom_domain: true`）、D1 绑定（只差 `database_id`）、R2 绑定、`DEMO_DATA`、`SITE_URL`、`SES_REGION`、`MAIL_FROM`。用户建好库以后，把 `database_id` 那一行的零换成真的 id，是一次小提交。

**www：** 只绑 `zhaogongnz.com` 一个地址。`www.zhaogongnz.com` 不绑到 Worker，用 Cloudflare 的跳转规则永久跳到 `https://zhaogongnz.com`（**Rules > Redirect Rules**，模板「Redirect from WWW to root」；`www` 要有一条开着橙色云朵代理的 DNS 记录，比如 `AAAA www 100::`，规则才接得到请求）。这样网站只有一个地址，`SITE_URL`、站点地图、分享链接都指向它。也可以把 `www` 也绑成自定义域名，但那样同一页有两个地址。

**设置：**

| 名字 | 值 | 为什么 |
| --- | --- | --- |
| `DEMO_DATA` | `true` | 页面显示演示数据；首页数字旁标「演示数据」 |
| `DB`（D1 绑定） | 库 `zhaogong-demo`（第 3 节，`--location=oc`） | 演示站也用正式的库结构，只是数据是演示的；和正式库分开 |
| `AUTH_SECRET` | 随机 32 字节以上 | 生产环境必须有。没有它，网站照样启动，但第一次有人要验证码时就报错、登录不了（不会出安全问题，只是部署后要试一次登录才看得出来） |
| `ZG_EVENTS_SECRET` | 随机 32 字节以上 | 漏斗统计；不设就不记 |
| `EVIDENCE_BUCKET` | R2 桶（第 4 节第 2a 步） | 举报截图；不绑的话登录不了也用不上，但代码在 Worker 里会拒收截图 |
| `PHOTO_BUCKET` | R2 桶（第 4 节第 2c 步） | 门店照片；不绑的话代码在 Worker 里会拒收照片 |
| `DATABASE_URL`、`DATABASE_AUTH_TOKEN` | **不设** | 线上用 D1 绑定，不用 libSQL 地址和令牌 |
| `ADMIN_ENABLED` | **不设** | 演示站不开审核后台 |
| `ZHAOGONG_ADMIN_EMAILS` | **不设** | 同上 |
| `ANTHROPIC_API_KEY` | **不设** | 对话发布显示「现在用不了」 |
| `EXTERNAL_JOBS` | **不设** | 不去公司网站导入真实职位 |
| `NEXT_PUBLIC_CLARITY_ID` | **不设** | 演示站不录 Clarity |

**只能浏览、不能登录（SES 还在沙盒）：** `SES_REGION`、`MAIL_FROM` 在 `wrangler.jsonc` 里，但两个 SES 访问密钥在离开沙盒前**不设**。`sesConfig()` 四个设置少一个就是 `undefined`，生产构建里 `devHelpersEnabled()` 为假（`NODE_ENV=production`，没有 `ZG_E2E`），所以 `canSendCodes()` 为假：登录页不显示表单，直接说「这个演示站暂时不能登录」并给「去看职位」的链接（#332），要验证码的请求也被拒（`no_mailer`）。`DEMO_DATA` 不影响这条路。不在沙盒里临时设密钥，是因为沙盒里只授权了发件域名，给验证过的收件人发信还要收件人身份的权限；离开沙盒后一次设好两个密钥就能登录。

**用户的操作顺序（Windows，在仓库根目录开终端，PowerShell 或 Git Bash）：**

1. `npx wrangler login`（浏览器里用公司的 Cloudflare 账号授权）
2. `npx wrangler d1 create zhaogong-demo --location=oc`，把打印出来的 `database_id` 发给导师；导师把它填进 `wrangler.jsonc`、合进 `main`
3. `npx wrangler r2 bucket create zhaogong-report-evidence --location=oc`（不开公开访问，不绑域名）
4. `npx wrangler d1 migrations apply zhaogong-demo --remote`：要在 `wrangler.jsonc` 已经填好第 2 步 id 的那份代码里跑（Wrangler 按名字在配置里找库，再用配置里的 id 连远程库；id 还是零就连不上）
5. 导入演示数据：`npx wrangler d1 execute zhaogong-demo --remote --file=<导师给的 SQL 文件>`（文件由 `npm run db:demo-sql` 生成、导师审过；只对全新的演示库导入一次，见本节末尾）。`DEMO_DATA=true` 不会自动填 D1
6. 建 Workers Builds 用的 API 令牌（第 4b 节「令牌」，要有 D1 Edit）
7. 用户先说「发布」（第一次推 `production` 也是发布）；导师把 `main` 推到 `production` 后，用户在 Cloudflare 后台 **Workers & Pages > Create application > GitHub**（有的界面叫 Import a repository） 选 `open-alternative-app/zhaogong`，名字填 `zhaogong-demo`，照第 4b 节的表设好再保存，第一次构建部署就会开始
8. Worker 建好后设密钥：`npx wrangler secret put AUTH_SECRET`、`npx wrangler secret put ZG_EVENTS_SECRET`（各粘贴一个 `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` 生成的值，两个不一样）
9. www 跳转（见上面「www」）
10. 打开 `https://zhaogongnz.com`：首页、`/jobs`、一个职位页、`/login`（应该是「暂时不能登录」）、英文页 `/en`、`/admin` 是 404；`https://www.zhaogongnz.com` 跳到 `https://zhaogongnz.com`

**部署前在本机先过一遍（最终集成验收）：** `npm run cf:build`，再 `npx wrangler deploy --dry-run` 看 `Total Upload`（没压缩的大小，免费和付费方案上限都是 64 MiB；后面的 gzip 只是参考、不算限额，见 Cloudflare [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/#worker-size)，2026-10-12 版；10-27 量到 19.6 MiB / gzip 4.41 MiB），再 `npm run cf:preview` 用本地 D1 打开第 11 步那几页。

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

本地维护命令还支持 `db:migrate`、`admin:revoke` 和 `import:external` 的 `--d1-local`。本机命令不操作远程库；演示数据及首位审核员 SQL 文件的远程导入另见后两节。`import:external --d1-remote` 仍不支持。Worker 配置开启日志和 traces，默认抽样 10%。


### 离线生成演示数据 SQL（2026-10-22 已在本机 D1 验证）

```powershell
npm run db:demo-sql
# 自选输出位置（路径含空格时加引号）
npm run db:demo-sql -- --output D:/dev/zg-scratch/d1/demo.sql
```

命令在全新的内存数据库中应用迁移、加载 `src/mock`，只导出数据 INSERT；不读取 `DATABASE_URL`、本机用户库或任何远程库，不联网抓取职位。默认输出 `data/d1-demo.sql`（已忽略），已有文件会拒绝覆盖。SQL 包含演示账号及演示审核员，不包含会话或验证码，只能用于演示库，不能用于正式站初始化。

**日期跟着导出那天走：** `src/mock` 里的职位（j1–j19）和它们的联系方式查看记录是从 2026-10-11 往回算的固定日期，原样导出的话，演示职位 11 月中就全部过期，列表会空掉。所以导出时把这批日期按整天往后挪，让最新一条职位的发布日期就是导出那天；状态本来就是「已过期」的（j17–j19）照旧过期，演示里其余的记录（将截止、已截止、待审核等）本来就从导出时间算。文件头会写这次挪了几天、应先迁移到哪个迁移号（读 `drizzle/meta/_journal.json`）。**所以在导入前一刻再生成，生成后先审。**

先迁移到文件头写的那个迁移号，再审阅 SQL。下面由有公司账号权限的人在部署时执行：

```powershell
npx wrangler d1 execute zhaogong-demo --remote --file=data/d1-demo.sql
```

数据库名必须对应配置中的演示绑定，不能指向正式库。SQL 开头检查所有应用表：任一表非空即通过约束错误拒绝导入，避免覆盖已有账号或重复填充；不要删掉这条检查。文件需整体交给 `--file` 导入，不能拆成逐条命令。INSERT 按外键依赖排好（被引用的表在前，按库结构算），远程导入不认 `PRAGMA defer_foreign_keys`，不靠它（B-17）。远程文件导入的失败回滚行为见 [Cloudflare D1 入门](https://developers.cloudflare.com/d1/get-started/#populate-your-d1-database)。

本轮已验证：91 条合成记录在本机 D1 成功导入；重复导入被拒绝，数据和外键保持完整；libSQL 单测逐表核对与原始演示数据一致。正式站第一位审核员使用下一节的独立流程，不能通过导入演示账号来代替。

**以后演示数据要刷新（职位又快过期了，或演示库被弄乱了）：** 导入只对空库生效，所以是「换一个空库再导」，只对演示库这样做，正式站绝不能这样做（第 5 节）：

1. 先留一份备份：`npx wrangler d1 export zhaogong-demo --remote --output=zhaogong-demo-<日期>.sql`（放本机，不进仓库）。
2. 删掉旧库、建一个同名的新库：`npx wrangler d1 delete zhaogong-demo`，再 `npx wrangler d1 create zhaogong-demo --location=oc`；新库的 `database_id` 填进 `wrangler.jsonc`（一次小提交，合进 `main` 再发布）。
3. 在填好新 id 的代码里：`npx wrangler d1 migrations apply zhaogong-demo --remote`，再当天生成一份 SQL（`npm run db:demo-sql`）、审过后 `npx wrangler d1 execute zhaogong-demo --remote --file=<文件>`。
4. 发布（推 `production`），Worker 才会连到新库。删库到发布之间演示站读不到数据，挑没人看的时候做。


### 正式站第一位审核员的离线 SQL

```powershell
npm run admin:grant-sql -- moderator@your-company.example
# 审阅 data/d1-moderator.sql 中的邮箱和语句后，由公司账号持有人执行：
npx wrangler d1 execute zhaogong --remote --file=data/d1-moderator.sql
```

将示例邮箱和数据库名替换成真实目标，不要直接照抄。生成文件不需要 Cloudflare 登录，也不会授予权限或联网；默认文件位于被忽略的 `data/`，已有文件拒绝覆盖，可用 `--output <路径>` 另存。SQL 文件包含审核员邮箱，作为运维文件保存，不提交仓库。

导入文件才会创建缺失的账号并授予审核员权限；已有账号的雇主身份、语言、创建时间等资料保留，重复导入保留原授权时间。它不创建会话、不发送验证码，也不打开 `/admin`。正式后台启用前，仍需准备登录邮件服务，并在构建时与运行时设置 `ADMIN_ENABLED=1`，然后检查非审核员无法进入。后续审核员增删由管理员（`ZHAOGONG_ADMIN_EMAILS`，ADR 0043）在受鉴权保护的 `/admin` 里操作；导入的这位审核员如果不在管理员名单里，只能处理审核，不能增删审核员。

本轮只在本机 D1 验证了生成、导入、重复执行及外键；远程数据库尚未执行这些命令。
