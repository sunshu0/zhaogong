# 0004 部署到 Cloudflare Workers + OpenNext

- 状态：已采纳
- 日期：2026-10-14（`0cd6b10`，用户授权发布演示站）

## 情况

需要一个能分享出去的演示站。应用用到了 Next.js 的动态页面、流式渲染和 Server Functions，不能静态导出，也不能把 `.next` 直接传到 Pages。

## 决定

- 用 `@opennextjs/cloudflare` 把 Next 应用打包成 Worker，`wrangler` 发布，Worker 名 `zhaogong-demo`。
- 版本固定：Next 16.3.8（16.4.0 在 Workers 上动态请求报错）、OpenNext 1.20.10、Wrangler 4.150.0、Node 24。
- 静态资源增量缓存；保留 Cache Components，关闭 OpenNext 的缓存拦截，让动态内容照常流出。
- `/admin` 默认关闭，`wrangler.jsonc` 不设 `ADMIN_ENABLED`（B24）。
- 发布由人决定，不接 Git 自动发布。

## 后果

- 演示站可以直接打开，但内存数据在实例之间不共享（ADR 0001）。
- 升级 Next 或 OpenNext 前要重新在本地 Workers 上做浏览器验收。
- 阶段三选数据库时要考虑 Workers 能用的驱动（ADR 0005、0006）。

详细步骤：`docs/cloudflare-deployment.md`。
