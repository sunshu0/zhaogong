# 关闭 JavaScript 时的找工（#13）

## 原因

找工用 Next.js 16 的 Cache Components。页面先发出静态外壳，每个 `<Suspense>` 里依赖请求数据的部分（职位列表、职位详情、雇主主页、登录表单）随后以流的形式发出：内容放在页面末尾的 `<div hidden id="S:n">` 里，再由一小段脚本移到原来的位置。关闭 JavaScript 时这段脚本不运行，内容一直隐藏，原来的位置只剩加载占位。

搜索引擎和社交平台的抓取程序不受影响。Next 对 `htmlLimitedBots`（默认名单，加上 `next.config.ts` 里补的微信、QQ、微博、小红书）会等所有内容完成后，一次发出完整的 HTML。

## 现在的做法

`src/components/seeker/NoScriptStreams.tsx` 在 `<noscript>` 里放了一段样式，只在 JavaScript 关闭时生效：

- 把流式内容显示出来，排在页面固定内容之后、页脚之前，按它们在页面上的先后顺序排列。
- 隐藏带 `data-nojs-hide` 的加载占位。
- Tailwind 的 preflight 在 `@layer base` 里用 `!important` 隐藏 `[hidden]`。规则写在更早的 `@layer theme` 里，才能压过它。

用到的页面：`/jobs`、`/jobs/[id]`、`/employers/[id]`、`/login`、`/resume/[id]`、实习和专业职位（`/internships`、`/professional`，在 `ExternalSectionPage.tsx` 里）、`/external/[id]`，以及整个 `/employer`（在 `src/app/[lang]/employer/layout.tsx` 里）。首页另有 `NoScriptLanding`，在 `<noscript>` 里直接给出平台数据和精选职位，不用这套样式。

浏览器测试：`e2e/no-js.spec.ts`（`javaScriptEnabled: false`），测职位列表、职位页、企业主页、登录、实习分区和外部职位页。

## 仍然需要 JavaScript 的部分

- **登录、聊天、工作台、发帖、审核：** 都在浏览器里运行。登录页会提示「登录需要浏览器开启 JavaScript」，不再停在占位上。
- **内容位置：** 流式内容回不到原来的位置，只能排在固定内容之后。现有页面每页只有一段，看起来正常；以后某个页面如果有多段流式内容，会按顺序一段接一段排在下面。
- **职位描述：** 只显示中文，切换到 English 要靠脚本。
- **筛选、分享、举报：** 筛选面板、分享按钮、举报表单都要靠脚本。
