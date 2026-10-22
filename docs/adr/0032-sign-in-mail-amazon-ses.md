# 0032 登录验证码用 Amazon SES（悉尼）发，从 Worker 用 HTTPS 接口直接调

- 状态：已采纳（用户 10-23 02:2x 定：「用 SES」；导师转达）
- 日期：2026-10-23。Issue #16。编号由导师 10-23 02:2x 给的。

## 情况

- 登录和注册只用邮箱验证码，没有密码（ADR 0007）。没有邮件服务，生产环境就发不出验证码：`canSendCodes()` 为假，登录页直接说「这个演示站暂时不能登录」，所有要登录的功能都用不了。
- 网站跑在 Cloudflare Workers 上（ADR 0029）。Worker 里不能开 SMTP 长连接，只能用 `fetch` 调 HTTPS 接口。
- 隐私页写的是数据放在大洋洲（第 6 节）。
- 现在只发一种信：6 位验证码，量很小（上线时每月几百到几千封）。
- 比较了 Amazon SES、Cloudflare Email Service、Resend、Postmark、SendGrid、Mailgun、阿里云邮件推送（价格、注册门槛、DNS、数据位置、能不能从 Workers 调），材料在仓库外 `D:/dev/zg-scratch/a8c5/mail-options.md`，来源都附了链接。

## 决定

1. **用 Amazon SES，区域悉尼（`ap-southeast-2`）。** 理由：
   - 价格最低：每千封 $0.10，没有月费。
   - 区域可选，悉尼和隐私页的「大洋洲」说得通。
   - SPF（自定义 MAIL FROM 子域）、DKIM、DMARC 都能对齐到我们自己的域名。QQ 邮箱的发信指南也要求这几样。
2. **调用方式：** SES v2 的 `SendEmail` HTTPS 接口（`POST https://email.<区域>.amazonaws.com/v2/email/outbound-emails`），用 `aws4fetch`（很小，专为 Workers 写的 SigV4 签名）签名。不用 AWS 的官方 SDK：它太大，在 Workers 里也不顺。
   - 代码：`src/lib/auth/ses.ts`（`sesConfig()` 读设置，`sendSesEmail()` 发一封纯文本信，从不抛错，10 秒超时，不重试）。
   - 调用方：`src/lib/auth/delivery.ts`。
3. **四个设置：** `SES_REGION`、`MAIL_FROM` 是变量（`SES_REGION` 写在 `wrangler.jsonc`）；`SES_ACCESS_KEY_ID`、`SES_SECRET_ACCESS_KEY` 是密钥（`wrangler secret put`）。访问密钥属于一个只有 `ses:SendEmail` 权限的 IAM 用户。
4. **四个都有才发信。** 少一个，`canSendCodes()` 照旧为假，生产环境拒绝登录，和以前一样。
5. **开发和测试构建永远不发真信。** `devHelpersEnabled()` 为真时，验证码照旧打到日志、显示在登录页，哪怕设了 SES。
6. **发不出去时：**
   - SES 拒收、超时或连不上，`requestCode` 删掉刚存的验证码，回 `send_failed`。
   - 登录页说「验证码没有发出去，请稍后再试」。
   - 因为验证码已删，「一分钟一封」的限制不拦这个人，可以马上再要。
   - 日志只记 SES 的状态码和错误类型，不记邮箱地址和验证码。
7. **退信和投诉：**
   - 现在只开 SES 的**账号级停发名单**（suppression list）：退信、投诉过的地址，SES 自动不再发。
   - 不接 SNS 回调，库里不记退信。
   - 这是以后的事：量变大，或者要在页面上告诉用户「你的邮箱退信了」时，再加一个接 SNS 通知的路由。

## 代价

- 要以公司名义开 AWS 账号（要付款方式），多一家服务商。隐私页第 5、6 节已加上 Amazon SES：只发验证码，在悉尼发，停发名单里留着退信或投诉的地址。
- 新账号先在沙盒里，只能发给验证过的地址；要申请离开沙盒，AWS 说 96 小时内回复。
- **QQ、163 能不能收到，没有可靠的公开数据。** 上线前必须用真实邮箱测。不行的话，国内邮箱另走阿里云邮件推送（新加坡区），按收件域名分流。这要再写一份 ADR。
- 只用了 SES 的一个接口。以后换服务商，只改 `ses.ts` 和 `delivery.ts`。

## 没选的

- **Cloudflare Email Service：** 不多一家服务商，但 2026-04 才公测，没有正式版；数据存哪没写明；发信域名看起来要用 Cloudflare 管 DNS。正式发布、写明数据位置后可以再考虑。
- **Resend：** 接入最简单，但账号数据只在美国；免费版每天最多 100 封，上线那天就可能不够。
- **Postmark、SendGrid、Mailgun：** 这个量下每月 $15–35，比 SES 贵很多，送达上看不出能多得什么。
- **阿里云邮件推送：** 国内邮箱也许送达更好（没有数据证明）；签名要自己写，境外区只有新加坡。留作国内邮箱的退路。
