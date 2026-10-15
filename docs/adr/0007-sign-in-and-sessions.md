# 0007 登录与会话：邮箱验证码 + 服务器会话

- 状态：已采纳；生产环境发邮件待用户决定（#16）
- 日期：2026-10-16（PR #28 合并，Closes #9；PR #29 让聊天也按会话读写，Closes #10）。最早的版本是第 8 轮的 A19（`parked/a19-auth`，10-13 用户取消后停放，第 12 轮重新启用）

## 情况

第 12 轮以前，「登录」只是浏览器 `localStorage` 里的一条演示会话，Server Functions 收页面传来的 `email` 参数并信任它（ADR 0001 的演示阶段）。找工要做成完整产品后：

- 任何人改一下 `localStorage` 或请求参数就能冒充别人、看别人的聊天、替别的企业发职位；
- 用户群是海外华人求职者和小店老板，不少人不想记密码；
- 发邮件用哪家服务要用户开账号（#16），在那之前本机开发和浏览器测试也要能登录；
- 一个账号有求职者和雇主两种身份（ADR 0003），当前身份要由服务器决定，而不是浏览器。

## 决定

- **邮箱验证码，不设密码。** 注册和登录是同一步：第一次用某个邮箱登录时创建账号（`requestSignInCode` → `signInAccount`）。
  - 验证码 6 位数字，10 分钟有效，同一邮箱每分钟最多发一次，错 5 次作废（`src/lib/auth/config.ts`）。
  - 库里只存验证码的 HMAC-SHA256（密钥 `AUTH_SECRET`；生产环境没有设置就拒绝运行），比较用 `timingSafeEqual`。每个邮箱只有一个有效验证码，新的替换旧的。
- **服务器会话，放在 httpOnly cookie 里。** cookie `zg_session` 里是 32 字节随机数；库里存它的 SHA-256、账号和当前身份，30 天过期。cookie 设 `HttpOnly`、`SameSite=Lax`，生产环境加 `Secure`。退出登录时删库里的会话和 cookie。
- **企业永远从账号查。** 会话只记邮箱和当前身份；企业每次用 `getAccountEmployer` 从账号查出来，不信任浏览器传来的企业编号。切到雇主身份要求账号确实有企业（`switchRole`）。所有需要身份的 Server Function 用 `getCurrentSession()`、`requireSession()`、`requireEmployer()`（`src/lib/auth/sessions.ts`）读会话，不收邮箱参数；雇主和审核接口在 #41（关闭 #19）改完。
- **存储放在接口后面。** `AuthStore`（`src/lib/auth/store.ts`）定义验证码和会话的读写；默认实现是数据库（`src/db/auth-store.ts`，`sign_in_codes`、`sessions` 两张表，ADR 0005），单测换成内存实现。
- **验证码怎么送达：**
  - 开发和测试环境：验证码打印在服务器日志，并随 `requestSignInCode` 的结果返回，登录页直接显示，浏览器测试不需要邮箱。
  - 生产环境：只发邮件，结果里永远不带验证码（`production-code.test.ts` 模拟了一个邮件服务，确认即使将来接上邮件，验证码也不会回到页面）。
  - 现在还没有接邮件服务，所以生产环境的 `requestSignInCode` 返回「邮件服务还没有配置，暂时无法发送验证码」，生产环境暂时登录不了。接哪家由用户决定（#16），接上时只需要改 `src/lib/auth/delivery.ts`。
- **浏览器里的会话只是副本。** `localStorage` 的 `zhaogong:session` 只用来显示（顶栏、底部导航按身份显示），每次加载页面用 `accountStatus()` 跟服务器对一次；改它不能登录任何人。切换身份先改副本、再等服务器确认，离开页面前没确认的切换下次加载时补发（`ca7bee2`、`0be0304`、`13ea3ff`）。

## 后果

- 冒充别人只剩偷 cookie 一条路；cookie 是 httpOnly，页面脚本读不到。
- 浏览器测试改用 `signIn()` 真实登录（读开发环境返回的验证码），不再往 `localStorage` 写假会话。
- 每个用到会话的请求都要查一次库（会话和账号的企业）。演示规模没有问题；量大时再考虑缓存。
- 聊天、交换和通知已读也按会话的身份存到服务器（#10，`src/app/messages/actions.ts`；#42 存进数据库），见 `docs/architecture.md`。
- 待办：生产环境的邮件服务（#16）。

## 补充：审核员角色（#50，2026-10-16）

用户决定审核后台按账号角色限定审核员，不用邮箱白名单。

- **存在哪里：** `moderators` 表（迁移 0003），每个审核员一行，记着谁在什么时候添加的。没有在 `accounts` 上加一列：给已有的表加 NOT NULL 列需要 SQL `DEFAULT`，而 0005 为了 D1 不用它。
- **怎么检查：** `requireModerator()`（`src/app/admin/moderator.ts`）依次查 `ADMIN_ENABLED`、会话、审核员；`/admin` 的每个 Server Function 都先调用它，不是审核员一律拒绝。页面本身是静态的，数据只从这些函数来。
- **第一位审核员：** 只能在服务器上用命令行 `npm run admin:grant <邮箱>` 添加，网页上没有自助成为审核员的入口。之后审核员在 /admin 的「审核员」一页里按邮箱增删；对方要先登录过一次（账号存在）。最后一位审核员不能被移除（命令行也一样）。
- **演示数据：** 开发和测试环境的演示数据带一个演示审核员 `moderator@example.com`；开发环境登录页会显示验证码，所以本机谁都能用它进 /admin。真正的数据库没有演示数据，从零个审核员开始。
- **浏览器测试：** 同一个邮箱一分钟只能要一次验证码，所以 Playwright 的 setup 项目（`e2e/moderator.setup.ts`）只登录一次演示审核员，保存会话；需要审核员的用例用 `moderatorPage()` 另开一个浏览器上下文。
- **还没有：** 操作日志还不记是哪位审核员做的（日志页去掉了原来写死的「演示管理员」）。
