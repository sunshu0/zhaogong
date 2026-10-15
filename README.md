# 找工 · 前端演示版

面向海外中文用户的招聘网站，当前以奥克兰的演示职位为例。包含职位筛选、求职者与雇主身份切换、AI 对话整理招聘、聊天、双向资料交换、通知和个人主页。

代码仓库：[open-alternative-app/zhaogong](https://github.com/open-alternative-app/zhaogong)（私有仓库，需要组织授权才能访问）。

本阶段只做前端：登录与验证码是模拟流程，AI 发帖使用本地规则，职位数据保存在运行实例内存中，聊天和资料保存在当前浏览器。没有真实认证、数据库、邮件或 AI 服务。

## 本地开发

使用 Node.js 24（`.node-version` 固定验证版本）和 npm：

```sh
npm ci
npm run dev
```

打开 http://localhost:8701 。同一仓库只运行一个开发服务器。

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

浏览器测试会发布演示职位，验收前重启服务器以清空测试数据。

### 持续集成

`.github/workflows/ci.yml` 在每个 PR 和推到 `main` 时跑同一套门槛：`npm run check`，以及 Playwright 浏览器测试（手机和桌面两个项目，失败时上传 `test-results/`）。目前组织的 GitHub Actions 账单问题还没解决，工作流可能无法启动；在那之前，每个 PR 的门槛仍在本机跑，结果写在 PR 正文里。

## Cloudflare

采用 **Cloudflare Workers + OpenNext**，已发布至 [找工演示站](https://zhaogong-demo.zhaogong.workers.dev)。可直接打开 [职位列表](https://zhaogong-demo.zhaogong.workers.dev/jobs) 验收。云端内存数据可能丢失，详细限制与发布验收记录见下方部署说明。

```sh
npm run cf:preview
npm run cf:dry-run
```

Workers 本地预览：http://localhost:8704 。`cf:dry-run` 仅构建和检查，不上传。

完整步骤、版本兼容说明和演示数据限制见 [Cloudflare 部署说明](docs/cloudflare-deployment.md)。代码结构见 [前端代码地图](docs/frontend-code-map.md)。
