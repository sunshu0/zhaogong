# 网页消息推送（C5 / #420）

隐私页改动（`src/i18n/messages/legal-privacy.ts` 和英文版）单独放在本功能最后一个提交里，用户同意后才合并。没有配置时网页如实显示暂未开放，站内聊天继续工作。

## 配置（尚未操作云端）

先在目标D1应用0041迁移，再发布经过验收的代码；发送密钥最后由有权操作账号的人设置。不要把正式private key放进仓库、Wrangler vars或客户端环境变量。

| 名称 | 含义 |
| --- | --- |
| `PUSH_VAPID_PUBLIC_KEY` | P-256原始公钥65字节（04前缀），base64url无padding；服务器验证后才给浏览器 |
| `PUSH_VAPID_PRIVATE_KEY` | 同一密钥对的私钥标量32字节，base64url无padding；Workers secret |
| `PUSH_VAPID_SUBJECT` | 运营方真实可联系的 `mailto:` 邮箱或HTTPS地址 |

三个值都按运行时服务器配置处理；没有 `NEXT_PUBLIC_*`。生产密钥由运营方生成保管，不在本文给固定密钥。轮换密钥后现有浏览器订阅可能需要用户关闭并重新开启；此版本没有自动迁移或多密钥兼容。

上线前核对：HTTPS同源worker `/api/push/worker` 能注册root scope；普通配置缺key显示不可用；使用支持的真实浏览器主动授权、收新聊天通用提醒、点击进有权限的聊天；两身份切换、登出、取消订阅和权限撤销。iOS/iPadOS需支持的版本且添加到主屏幕。通知送达是辅助功能，不承诺实时或可靠送达。

## 隔离门槛：两次服务器运行

所有命令只在导师安排的D克隆/资源锁下执行；不在主预览或线上操作。依赖和lockfile未改。完整门槛先用**无三个PUSH设置**的普通ZG_E2E构建，所有已有测试正常运行，并真实验证缺配置时不开权限。`e2e/push.spec.ts`的配置专用案例会明确跳过。

随后用相同冻结源树、同一个ZG_E2E构建，重启测试服务器并在它及Playwright进程注入临时测试配置，运行该spec。测试标记 `C5_PUSH_TEST=1` 只由测试文件读取，不改变应用行为。运行时key无需重新build。

下面是生成**一次性的本机合成测试key**的PowerShell片段；只存当前进程环境，不输出private key、不写文件。必须在导师的受控任务包装器中执行，不能绕资源锁直接起服务器。

```powershell
$pairJson = node -e 'const c=require("node:crypto");const k=c.createECDH("prime256v1");k.generateKeys();process.stdout.write(JSON.stringify({publicKey:k.getPublicKey().toString("base64url"),privateKey:k.getPrivateKey().toString("base64url")}));'
$pair = $pairJson | ConvertFrom-Json
$env:PUSH_VAPID_PUBLIC_KEY = $pair.publicKey
$env:PUSH_VAPID_PRIVATE_KEY = $pair.privateKey
$env:PUSH_VAPID_SUBJECT = 'mailto:local-test@example.invalid'
$env:C5_PUSH_TEST = '1'
# 在受控任务中运行生产测试服务器和：npx playwright test e2e/push.spec.ts
```

ZG_E2E构建把真实发送器固定为不发送并返回failed；即使测试环境中有合法厂商URL也不会访问厂商。UI测试替代Notification/PushManager、生成有效P-256浏览器公钥，只验证权限与订阅状态链；服务器保存、会话/角色校验及关闭不mock。普通unit用mock fetch核加密请求、独立Node解密及验签；真实Service Worker路由/注册另测，没有真实系统通知弹窗。真实厂商送达和生产Workers背景生命周期需要后续线上授权实测，不能据本机测试称完成。

门槛需运行fmt/typecheck/lint/unit/普通Next build/D1/Cloudflare构建及既有浏览器分片；新DB测试已被现有D1 glob包含。0041 snapshot静态从0040扩展，请门槛核对schema和snapshot一致、下一次db:generate无重复新表；不得提交生成的0042空迁移或改旧迁移。
