# 找工

面向海外中文用户的招聘网站，当前以奥克兰的演示职位为例。包含职位筛选、求职者与雇主身份切换、AI 对话整理招聘、聊天、双向资料交换、通知和个人主页。

代码仓库：[open-alternative-app/zhaogong](https://github.com/open-alternative-app/zhaogong)（私有仓库，需要组织授权才能访问）。

职位、企业、账号、举报、审核记录和联系方式查看记录存在数据库里（Drizzle + libSQL，见下方「数据库」）。登录与验证码仍是模拟流程（服务器会话见 #9），AI 发帖使用本地规则，聊天和资料暂存在当前浏览器（#10）。没有邮件或 AI 服务。

## 本地开发

使用 Node.js 24（`.node-version` 固定验证版本）和 npm：

```sh
npm ci
npm run dev
```

打开 http://localhost:8701 。同一仓库只运行一个开发服务器。第一次启动时会自动建库并导入演示数据（见下方「数据库」）。

Windows 若遇到 Next 遥测配置的 `EXDEV` 错误，先在当前 PowerShell 设置：

```powershell
$env:NEXT_TELEMETRY_DISABLED = '1'
```

## 检查

```sh
npm run check
```

包含格式、TypeScript、ESLint、单元测试和 Next 生产构建。已有开发服务器运行时，PowerShell 浏览器测试命令为：

```powershell
$env:E2E_PORT = '8701'
npm run test:e2e
```

浏览器测试会把演示职位写进数据库。验收前先停掉开发服务器，运行 `npm run db:reset`，再启动，就回到干净的演示数据。

## 数据库

本机用 libSQL 文件 `data/zhaogong.db`（不进 git）。表结构在 `src/db/schema.ts`，版本化迁移在 `drizzle/`，演示数据来自 `src/mock/`。

| 命令 | 作用 |
| --- | --- |
| `npm run db:migrate` | 把 `drizzle/` 里还没执行的迁移应用到数据库 |
| `npm run db:seed` | 先迁移；数据库是空的就导入演示数据，已有数据则不动 |
| `npm run db:reset` | 删除本机数据库文件（先停开发服务器），之后用 `db:seed` 或重新启动开发服务器建一个新的 |
| `npm run admin:grant <邮箱>` | 把这个账号设为审核员（账号不存在就先建一个），用来添加第一位审核员；之后审核员在 /admin 里增删 |
| `npm run admin:revoke <邮箱>` | 取消审核员（最后一位不能取消） |
| `npm run db:generate` | 改了 `schema.ts` 之后生成下一个迁移文件，连同 `drizzle/meta` 一起提交 |

- 开发服务器第一次读写数据时会自动迁移；数据库为空、并且 `DEMO_DATA` 允许时，还会导入演示数据。`DEMO_DATA` 在开发和测试中默认开启，生产构建中默认关闭。设 `DEMO_DATA=false` 可以从空库开始开发。
- 演示数据里能直接看到的功能（#88，日期按导入当天算）：用 `boss@example.com` 登录并选「川味小馆」，职位管理里有一个 2 天后截止的职位（续期）和一个 20 天前已截止的职位（重新发布）；`moderator@example.com` 是审核员，审核后台有一条发布时被标记的职位、两条举报和两份企业验证申请（#78）；`seeker@example.com` 是求职者，有两个收藏、一个职位提醒和它找到的新职位通知。开发环境登录页会显示验证码。
- `DATABASE_URL` 可以指定别的库：例如 `file:./data/other.db`；`file::memory:` 是一次性的内存库，服务器重启后就清空。单元测试中每个测试文件各用一个内存库。
- 线上用哪种数据库（Turso 或 Cloudflare D1）由用户决定（#15），取舍记录在 ADR 0006。决定之前不建远程数据库，也不用当前代码重新部署。

### 持续集成

`.github/workflows/ci.yml` 在每个 PR 和推到 `main` 时跑同一套门槛：`npm run check`，以及 Playwright 浏览器测试（手机和桌面两个项目，失败时上传 `test-results/`）。目前组织的 GitHub Actions 账单问题还没解决，工作流可能无法启动；在那之前，每个 PR 的门槛仍在本机跑，结果写在 PR 正文里。

**开发阶段已停用，交付时启用：** 工作流现在是停用状态（`gh workflow disable CI`），开发期间不要启用或手动触发；交付时用 `gh workflow enable CI` 重新启用。

### 评分

```sh
node scripts/score.mjs
```

按用户的项目评分表统计已知证据得分：先 `git fetch origin --tags`，再从 `origin/main`（`--ref` 可改）和 `gh` 读取提交、PR、Issue、Release、CI 运行和仓库里的工程资料，输出每一项的原始数据和得分。拿不到的数据显示「无法取得」、计 0 分，并写进限制说明。计分规则在 `scripts/score-rules.mjs`，有单测。

## Docker

`Dockerfile` 把应用作为 Node 服务（`next start`）打包，`docker-compose.yml` 再加一个 libSQL 数据库服务：

```sh
docker compose up --build
```

应用在 http://localhost:3000 。数据库接入（#8）合并前，应用仍使用内存演示数据，数据库服务不会被用到。**这两个文件还没有在本机实际运行过**：在本机使用 Docker 要等用户批准。

## Cloudflare

采用 **Cloudflare Workers + OpenNext**，已发布至 [找工演示站](https://zhaogong-demo.zhaogong.workers.dev)。可直接打开 [职位列表](https://zhaogong-demo.zhaogong.workers.dev/jobs) 验收。云端内存数据可能丢失，详细限制与发布验收记录见下方部署说明。

```sh
npm run cf:preview
npm run cf:dry-run
```

Workers 本地预览：http://localhost:8704 。`cf:dry-run` 仅构建和检查，不上传。

绑定自定义域名后设置环境变量 `SITE_URL`（例如 `https://example.com`），`sitemap.xml`、`robots.txt` 和职位的结构化数据都用它生成绝对地址；没设置时用请求的域名。

完整步骤、版本兼容说明和演示数据限制见 [Cloudflare 部署说明](docs/cloudflare-deployment.md)。代码结构见 [前端代码地图](docs/frontend-code-map.md)。
