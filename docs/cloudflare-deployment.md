# Cloudflare 部署说明

## 部署对象

已于 2026-10-14 经用户授权发布：[找工演示站](https://zhaogong-demo.zhaogong.workers.dev)，职位列表在 [/jobs](https://zhaogong-demo.zhaogong.workers.dev/jobs)。Worker 为 `zhaogong-demo`，最终发布版本 `d11cd051-63ae-4e62-a29a-bde6bad0ba28`。HTTPS 已启用，尚未绑定自定义域名，也未配置 Git 自动发布。

这是找工的**前端演示版**，部署至 Cloudflare Workers，通过 OpenNext 保留 Next.js 的动态页面、流式渲染和 Server Actions。不能把 `.next` 直接上传至 Pages，也不使用静态导出。

当前配置不需要数据库、R2、KV、Durable Objects、邮件服务或 AI 密钥。业务仍读取模拟数据。`ASSETS` 提供页面资源及构建时缓存；`WORKER_SELF_REFERENCE` 用于适配器内部请求。

## 固定版本与配置

- Node.js：24，当前验证版本为 `.node-version` 中的 24.19.0。
- Next.js / eslint-config-next：16.3.8。
- OpenNext Cloudflare：1.20.10。
- Wrangler：4.150.0。
- Worker：`zhaogong-demo`，首先使用账户的 `workers.dev` 域名。
- `compatibility_date`：2026-09-01，启用 `nodejs_compat` 和 `global_fetch_strictly_public`。

Next 16.4.0 虽然能完成 OpenNext 构建，但本地 Workers 动态请求会报 `Unexpected loadManifest(/.next/server/preview-props.json)`，因此固定在适配器支持的 16.3.8。以后升级 Next 或 OpenNext 时，应重新执行 Workers 浏览器验收。

配置文件：`wrangler.jsonc`、`open-next.config.ts`、`next.config.ts`。修改 Worker 名称时，同时修改 `wrangler.jsonc` 的 `name` 和 `services[0].service`，二者必须一致。确认目标账户不存在需要保留的同名 Worker，再执行发布。

站点的安装名称、图标和 manifest 链接直接写入根布局的静态 `<head>`，避免动态职位元数据输出到 `<body>` 后，Safari 找不到安装标签。manifest 保存在 `public/manifest.webmanifest`，单元测试检查品牌、颜色和图标尺寸。职位分享元数据仍使用 Next 元数据 API，保留原有爬虫与中文分享应用的阻塞渲染配置，以及 `partialPrefetching`。

使用静态资源增量缓存，是因为当前应用没有 ISR、`use cache` 或按需重新验证。保留 `cacheComponents` / PPR，关闭 OpenNext 的 `enableCacheInterception`，让 Next 恢复页面中的动态内容；不能只返回缓存的页面框架。以后新增可写缓存功能时，须更换缓存配置并复验。头像由浏览器保存，图片不调用 Cloudflare Images。

## 本地准备与验收

```sh
npm ci
npm run check
npm run cf:build
```

PowerShell 构建前可设置环境变量，避免本机 Next 遥测配置写入的 `EXDEV` 问题：

```powershell
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:WRANGLER_SEND_METRICS = 'false'
```

启动实际 Workers 运行环境的本地预览：

```sh
npm run cf:preview
```

打开 http://localhost:8704 。此命令先构建，再启动本地 workerd，不连接远程资源。保留预览运行，在另一 PowerShell 窗口执行浏览器测试：

```powershell
$env:E2E_PORT = '8704'
npm run test:e2e
```

先启动 Workers 预览再跑测试，否则现有 Playwright 配置会启动普通 Next 开发服务器，不能验证 Cloudflare 的兼容性。测试改变实例内的演示数据，验收前应重启预览。

检查上传包和资源绑定，但不实际上传：

先在预览终端按 `Ctrl+C` 关闭预览。Windows 中运行中的预览会锁定 `.open-next`，而下面的命令需要重新构建；实际发布前也应先关闭预览。

```sh
npm run cf:dry-run
```

可选的绑定类型生成：`npm run cf:typegen`。生成文件 `cloudflare-env.d.ts` 已忽略；应用当前没有直接访问业务绑定。

## 实际发布

用户确定发布后，在目标 Cloudflare 账户登录并部署：

```sh
npx wrangler login
npm run cf:deploy
```

`cf:deploy` 会重新构建并上传 Worker 和静态资源。使用命令返回的地址验收：首页、职位筛选和详情、模拟登录与身份切换、AI 对话发布、雇主主页、聊天资料交换、通知跳转、个人资料与头像。若以后绑定自定义域名，在 Cloudflare 控制台该 Worker 的 Domains & Routes 中设置。

无需为这个演示版配置业务密钥。自动化发布应通过 CI 的保密变量保存 Cloudflare API token，不能写进代码、配置文件或文档。

## 以后接入 Workers Builds

代码已连接私有仓库 [open-alternative-app/zhaogong](https://github.com/open-alternative-app/zhaogong)。本机 `origin` 仍指向原裸仓库，新增的 `github` 远程指向 GitHub；只推送 `main`，分仓与存档分支保留在本机。目前尚未连接 Cloudflare Workers Builds，也未配置 GitHub Actions 自动发布。以后授权连接构建时选择 **Workers** 项目，根目录为本仓库根目录，构建环境使用 Node 24。

- 依赖安装：`npm ci`。
- 构建命令：`npm run check && npm run cf:build`。
- 部署命令：`npx opennextjs-cloudflare deploy`，复用上一阶段的构建产物。
- 构建变量：`NODE_VERSION=24.19.0`、`NEXT_TELEMETRY_DISABLED=1`。

OpenNext 官方对原生 Windows 的支持有限。本机验证使用 Windows；自动构建优先使用 Cloudflare 的 Linux 环境或 WSL/Linux。Linux 上重新 `npm ci`，不要复用 Windows 的 `node_modules`。若在本机连续构建时遇到生成目录锁定，先关闭 Workers 预览再重新构建。

部署工具的 `@node-minify/core` 间接依赖通过 `overrides` 固定为已修复命令注入的 `glob@10.5.0`；这项覆盖只影响该工具的依赖分支。发布准备使用 `npm audit --omit=dev` 检查应用运行依赖。完整审计仍包含现有 ESLint 工具链的 `braces` 告警，当前上游没有可用修复版；不要用 `npm audit fix --force` 降级 Next 工具链。

## 演示环境的真实限制

- 登录不验证真实邮箱，验证码不通过邮件发送；后台也是公开演示页面，不能当作生产权限系统。
- AI 发帖是本地规则演示，没有调用模型。
- 职位发布、企业登记、举报和统计使用实例内存：Worker 重启、更新或分配到另一个实例后可能消失或不同步，不能保证跨用户持久保存。
- 聊天、通知、双向交换、主页和头像主要使用当前浏览器的 localStorage：不跨设备同步，也不是双方真实即时通信。
- 本地 workerd 验证能够检查适配兼容性，但不代替发布后的账户域名、流量配额和实际请求性能验收。

## 本轮验证结果

实际线上验收：桌面/手机首轮 25 项通过、1 项失败，失败为手机新建企业后再次打开发布页时雇主身份丢失；单项复测通过，不能据此认为云端内存会稳定保存。AI 对话生成招聘、合规修改及发布的 2 项桌面验收通过。采集到的 106 个运行事件均为 `ok`，无异常记录。日志在 `D:/dev/zhaogong-cloudflare-release-browser.log`、`-recheck.log`、`-ai-browser.log`、`-runtime.log`、`-deploy.log`。验收后复用已验证构建重新发布，清理实例内测试数据。

以下为发布前的本地准备验证记录：

- Windows / Node 24.19.0：`npm run check` 通过，包含格式、类型、lint、287 项单元测试和 Next 生产构建。
- OpenNext Workers 构建通过；Wrangler `deploy --dry-run` 通过，压缩包约 1501.97 KiB（1.47 MiB），低于免费方案的 3 MiB 上传包限制。实际请求配额与 CPU 限制仍以目标账户和上线验收为准。
- 真实本地 workerd（8704）的桌面/手机浏览器全量验收：161 通过、1 条件跳过，跳过的是桌面端不适用的触控场景；涵盖登录、身份切换、职位浏览与发布、聊天、交换与举报、通知、主页、头像、推荐人才、安装标签及无障碍检查。
- 增加 6 项身份同步单测和桌面/手机的延迟校验回归用例，验证用户在校验返回前切换身份或打开主页时，最新选择不会丢失。实际写入仍检查服务器上的演示账号。
- `npm audit --omit=dev` 为零项漏洞；依赖锁文件的 `npm ci --dry-run --ignore-scripts` 解析通过。
- 验收结束后关闭测试用 Workers 预览，释放 Windows 构建目录；普通前端预览仍在 8701。本轮没有执行账户登录、发布 Worker、绑定域名、创建远程资源或推送代码。

本机验证日志放在仓库外的 `D:/dev/`：`zhaogong-cloudflare-check.log`、`zhaogong-cloudflare-build.log`、`zhaogong-cloudflare-dry-run.log`、`zhaogong-cloudflare-browser.log`、`zhaogong-cloudflare-validation-preview.log`。

## 官方参考

- [Cloudflare 的 Next.js 部署指南](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare 入门](https://opennext.js.org/cloudflare/get-started)
- [OpenNext 缓存配置](https://opennext.js.org/cloudflare/caching)
- [Cloudflare Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
