# 0023 中英切换：自写字典，网址不变，内部按语言各预渲染一份

- 状态：已采纳
- 日期：2026-10-19（Round 20 第 1 步）。第 0 步的字典机制是 #199，三条线的字典是 #199、#200、#201。导师 10-18 19:1x 同意了文末「要先定的」三条。

## 情况

1. **没有多语言机制。** 界面文字直接写在组件里（约 300 个文件、3,000 多行中文）。`src/i18n/labels.ts` 只有一部分中英对照。`<html lang="zh-CN">` 写死在根布局里。
2. **日期和数字的格式写死成中文。** 多处 `Intl` 写死 `"zh-CN"`，`seeker/format.ts` 里有只会说中文的函数（`postedAgoZh`）。
3. **Cache Components 开着**（`cacheComponents: true`）。在 `<Suspense>` 外读 `cookies()`，整条路由就不能预渲染；放进 `<Suspense>`，那一块就每次请求现算。所以「同一个网址按 cookie 显示」只有两种做法：要么每一处文字都放进读 cookie 的 Suspense（静态外壳里没有文字，`<html lang>` 也没法跟着变），要么每种语言各预渲染一份，按 cookie 决定给哪一份。
4. Next 16 的国际化指南用的是第二种：页面放进 `app/[lang]/`，根布局用 `generateStaticParams` 列出语言，服务器组件用 `next/root-params` 的 `lang()` 拿语言。指南默认网址带 `/en`；要网址不变，就在 proxy 里按 cookie 做 rewrite。
5. 用户内容（职位描述、聊天、简历、企业介绍）不翻译，只换界面文字。AI 发帖第一期照旧生成中文。

## 决定

### 1. 语言和默认值
- 两种语言：`zh`（`<html lang="zh-CN">`）和 `en`（`<html lang="en-NZ">`）。代码里只用 `zh` / `en`，BCP 47 的写法由 `localeTag(lang)` 换算（`src/i18n/lang.ts`）。
- 默认中文，**不看浏览器的 `Accept-Language`**：很多海外华人的系统是英文的。没有 cookie 的访客、搜索引擎、测试的浏览器都是中文。

### 2. 网址和路由
- 用户看到的网址不变，没有 `/en`。
- 页面都在 `src/app/[lang]/` 下。根布局 `generateStaticParams() → zh、en`，每个页面各预渲染一份。
- 留在 `src/app/` 根下、不分语言的：`api/`、`robots.ts`、`sitemap.ts`、`globals.css`。`global-error.tsx` 取代根布局，拿不到语言，所以中英两种都写。
- 不存在的网址到 `[lang]/[...missing]/page.tsx`（`notFound()`），显示 `[lang]/not-found.tsx`，按语言出 404 卡片。
- **`src/proxy.ts`** 管所有页面（matcher 排除 `_next/`、`api/` 和带扩展名的文件）：
  - 读 cookie `zg_lang`，不是 `en` 就当 `zh`，`NextResponse.rewrite` 到 `/${lang}${pathname}`，浏览器地址栏不变（`langRoute()`，有单测）。
  - 地址本身带 `/zh`、`/en` 的，308 跳回不带前缀的网址，一个页面只有一个网址。
  - 原来 `/jobs/:id` 发访客 id 的逻辑照旧（#79、#90）。
  - 页面跳转时取的服务器组件数据、预取、Server Function 的 POST 都经过 proxy，拿到的是 cookie 的语言。
- 服务器渲染的路径带 `/zh`（rewrite 之后），浏览器里没有。客户端组件看路径时一律用 `useSitePathname()`（`src/i18n/client.tsx`，去掉语言那一段），两边一样，不会 hydration 对不上。

### 3. 字典
- **不加库。** 每个模块一份 TypeScript 字典，放 `src/i18n/messages/<模块>.ts`。先写中文，再用 `Dictionary<typeof 中文>` 定英文的类型：英文少键、多键、函数参数对不上，`tsc` 都会报错。带数字、名字的说法写成函数，不搞模板语法。
- `labels.ts` 是两种语言的名称表（`LABELS[id][lang]`），英文照术语表改过（Hair and beauty、NZ citizen or resident、Not verified 等）。地区和国家本来就有英文名（`nameEn`）。
- 英文照术语表（Employment New Zealand、Immigration New Zealand 的官方说法）和导师的决定写。

### 4. 服务器组件、客户端组件、Server Function 怎么拿语言
- **服务器组件：** `const t = await messages(xxxMessages)`；日期、数字用 `await serverLang()`。里面用 `next/root-params` 的 `lang()`，不一层层传参，页面照样静态。
- **客户端组件：** 根布局把语言交给 `<LangProvider lang>`；客户端组件用 `useMessages(xxxMessages)`、`useLang()`。客户端组件用到的字典两种语言都会进前端的 JS，用性能预算（#169）盯着。
- **两边都会渲染的共用组件**（`VerificationBadge`、`PayReferenceBox`）：传 `lang` 参数，默认中文。
- **Server Function、Route Handler：** 读不到根参数，用 `requestLang()`（读 cookie，规则和 proxy 一样）。
- **单测：** `next/root-params` 只有 Next 的编译器能填，`vitest.config.mts` 把它指到一个替身（`src/i18n/testing/root-params.ts`，返回空，也就是中文）。要测英文的单测自己 mock。
- **性能预算：** 构建报告里的路由带 `/[lang]`，`scripts/perf-budget-rules.mjs` 的 `siteRoute()` 去掉这一段，预算还是按用户看到的网址记。

### 5. 切换按钮、cookie 和账号设置
- 切换按钮（`src/components/ui/LangSwitch.tsx`）写的是另一种语言本身的名字（「English」/「中文」）。放在三处：顶栏（768 px 起，手机顶栏放不下）、页脚（手机和没登录的人也能切）、「我的」。
- 按下后调 Server Function `setLang`（`src/i18n/actions.ts`）：
  1. 写 cookie `zg_lang`：`zh` / `en`，一年，`Path=/`，`SameSite=Lax`，`HttpOnly`，正式环境加 `Secure`（`src/i18n/cookie.ts`）。
  2. 已登录的话写进账号：`accounts.lang`（迁移 0025，可以为空，空就是没选过）。
  3. 然后**整页刷新**：Next 会把看过的页面和预取的数据留着，只刷新当前路由，返回上一页时还是旧语言。
- **登录时**（`signInAccount`）：账号存过语言就用账号的；和这个浏览器的不一样时改 cookie，返回 `reload`，登录页用整页跳转进入。账号没存过，就把当前 cookie 的语言写进账号。换一台设备登录，语言还在。
- 账号数据导出带这一列；删除账号时随账号一起删（ADR 0009）。

### 6. `<html lang>` 和用户内容的 `lang`
- 根布局：`<html lang={localeTag(lang)}>`。
- 英文界面里，已知是中文的用户内容（`titleZh`、中文的企业名等）套 `lang="zh-CN"`，读屏软件才会用中文读，在第 2 步各页面接字典时做。语言不确定的自由文本（描述、聊天）不标，跟着页面。正文要不要换成 Archivo 在前的字体栈，留给设计规范另定。

### 7. 日期、数字、金额
- `src/i18n/format.ts` 按语言给出格式化函数，时区一律 `Pacific/Auckland`，格式化器按语言和选项缓存。
- 写死 `"zh-CN"` 的 `Intl` 在第 2 步各线接字典时换成按语言取。只为拼机器格式（`YYYY-MM-DD`、24 小时制）的 `en-CA`、`en-GB` 不动。
- 时薪的写法（区间、「起」、每小时）在字典的函数里，数字交给 `format.ts`。

### 8. 页面标题和其他
- 根布局的 `generateMetadata` 按语言给标题和描述，`title.template` 也从字典来。各页的标题在第 2 步跟着接字典。
- `manifest` 只有一份，用产品名（产品名待定，#18）。
- `sitemap` 只列不带前缀的网址。

### 9. 以后要加 `/en`（英文 SEO）时怎么改
- 内部已经有 `[lang]`，路由不用再动。要改的是：proxy 放行 `/en/...`；站内链接经过一个 `localeHref(href)` 带上前缀（这是最大的一块，所以现在不做）；`metadata.alternates.languages` 和 `sitemap` 两种语言都列。
- **部署时**：同一个网址的 HTML 按 cookie 不同，**CDN 不能只按网址缓存页面**（要么不缓存 HTML，要么缓存键带上 `zg_lang`）。这一条要写进部署的 ADR。

### 10. 顺序
- 第 0 步：字典机制和三条线的字典，只加新文件（#199、#200、#201）。
- 第 1 步（这一步，A）：挪进 `[lang]`、proxy、根参数、`LangProvider`、切换按钮、cookie 和 `accounts.lang`、`<html lang>`、`src/components/ui` 的文字、中文名统一（「企业主页」「我的主页」）、`labels.ts` 和 `countries.ts` 的英文、这份 ADR。页面文字还是中文，只是英文界面能打开了，没接字典的地方先显示中文。
- 第 2 步：三条线并行，各自把组件接上字典。第 3 步：中英各走一遍全站，找漏翻和挤版。

## 后果

- 用户看到的网址不变，两种语言的页面都能预渲染（静态外壳和现在一样），`<html lang>` 跟着语言走。
- **一次性挪目录**：`src/app/**` 的页面都进了 `src/app/[lang]/`，`@/app/...` 的引用和文档里的路径跟着改了。挪的时候三摞都已合并；之后各线从新 main 开分支。CLAUDE.md 里「谁管什么」的路径要跟着改（导师定）。
- **构建：** 预渲染的页面数翻倍，构建时间和 `.next` 体积相应增加。
- **proxy 管所有页面请求**（原来只管 `/jobs/:id`），每个请求多一次很轻的判断。
- **切换语言会整页刷新一次。**
- **测试：** 现有 e2e 照旧用中文（默认语言）。英文的检查（cookie `zg_lang=en` 下的 axe、横向溢出、漏翻的中文）在第 3 步加。
- **还没覆盖的：** 邮件（#16）接上后按账号的 `lang` 发；AI 发帖第一期只生成中文。

## 不选的做法

- **不挪目录，cookie 在 Suspense 里读。** 顶栏、底栏、页脚、标题都变成动态的，预渲染的外壳里没有文字，打开页面先是一片骨架；`<html lang>` 只能写死中文，或者让整站阻塞渲染。
- **只在浏览器里换文字。** 英文用户每次都会先看到一闪而过的中文，关了 JS 的浏览器只有中文。
- **用 i18n 库（next-intl 等）。** 这套字典几十行就够，`tsc` 就能保证中英两边的键一样；库能多给的（ICU 消息格式、网址前缀管理），现在用不上。
- **按浏览器语言自动切换。** 很多海外华人的系统是英文的，却想看中文。
