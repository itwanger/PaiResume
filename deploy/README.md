# 派简历上线运行手册

本目录提供可审查、可演练的生产部署材料；仓库根目录的 `launch.sh` 在显式执行 `deploy`、`status` 或 `rollback` 时会连接生产环境。首次上线默认从已确认的提交或标签构建；若明确使用 working-tree 模式，发布包必须记录基准提交、脏工作区标记和内容摘要，保证制品仍可追溯。

2026-07-24 已通过该流程把版本 `6a8c5345beac-20260724T025733Z` 部署到 `https://resume.paicoding.com`。目标目录、本地 Linux 构建上传、无全局 Node、MySQL/Redis 边界、沿用 root 运行身份、派聪明扫码桥、证书续期和真实发布结果见 `production-deployment-decisions.md`。不能在生产机上临时拼接未审查的发布命令。

当前工作树仍有未提交改动。将确认后的代码提交并推送到 GitHub `main` 后，从仓库根目录执行下面一条命令即可拉取最新远端引用、在本地 Linux builder 中测试和构建，再把最小运行制品上传并激活；生产机不会执行 Git、npm 或 Maven：

```bash
./launch.sh deploy --fetch origin/main
```

只查看状态使用 `./launch.sh status`。只有明确要发布当前未提交工作树时才使用 `./launch.sh deploy --working-tree`；首个生产版本没有 `previous`，第二次成功发布后才可使用 `./launch.sh rollback` 一键切回上一版本。

## 三阶段开关

1. 知识星球邀请灰度：`DEPLOY_STAGE=free`，会员与用户市场新订单仍可关闭；派聪明扫码注册/登录必须启用，知识星球会员通过 `/vip/claim` 领取 VIP。扫码注册、VIP 开通、编辑保存、排版导出和 AI 分析必须完成 `checklists/planet-core-acceptance.md` 并设置 `PLANET_CORE_ACCEPTANCE_CONFIRMED=true`。人工精修、会员购买和用户市场分别按各自清单验收。
2. 会员支付：先在隔离的预发布域名和测试账号中使用 `DEPLOY_STAGE=membership-acceptance`、`PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED=true`，并在 Admin 填写、启用真实微信商户配置后执行 `checklists/wechat-payment-acceptance.md`。人工精修的会员免费排队、邮件投递和可选加急还需单独执行 `checklists/resume-review-acceptance.md`；开放加急前才要求设置 `RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED=true`。会员阶段仍由 `DEPLOY_STAGE=membership`、`MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED=true` 控制。用户市场保持关闭。
3. 用户付费简历市场：再用 `DEPLOY_STAGE=marketplace-acceptance` 在隔离环境完成 `checklists/marketplace-payment-acceptance.md`。正式获批后使用 `DEPLOY_STAGE=marketplace`、两个支付验收确认位与 `MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED=true`；市场功能和两个新订单开关均允许在维护时关闭，Admin 微信支付配置保持启用以处理历史回调与对账。

旧变量 `PAYMENT_ACCEPT_NEW_ORDERS` 必须始终为 `false`，不能用它同时打开两类订单。

人工精修的真实单价保存在后台平台配置中，数据库默认值为 `0`。发布脚本不会猜测价格；价格未配置、支付 Provider 不是真实微信或独立开关未开时，包括首份在内的任何请求都必须拒绝下单。

人工精修不设置业务开关，导航、排版导出入口与公开脱敏队列始终存在。生产环境必须配置真实微信支付、SMTP 授权和私密收件箱。人工精修 PDF 不使用 OSS，提交时经后端内存校验后作为邮件附件直接投递。

## 派聪明扫码登录边界

- 目标登录主入口使用“派聪明”服务号；首发临时保留邮箱兼容登录。桥接启用后，PaiResume 只保存 AppID 和独立 HMAC 密钥，不保存服务号 AppSecret/access_token。
- paicoding 进程需要同步配置 `PAIRESUME_WECHAT_BRIDGE_ENABLED=true`、`PAIRESUME_WECHAT_BRIDGE_CALLBACK_URL=https://resume.paicoding.com/api/public/wechat/bridge/events`、`PAIRESUME_WECHAT_BRIDGE_SECRET` 和相同 `PAIRESUME_WECHAT_SCENE_PREFIX`；共享密钥必须与 PaiResume 的 `PAICONGMING_WECHAT_BRIDGE_SECRET` 完全一致，且不能与其他应用密钥复用。
- 人工精修不再提供关注公众号换取第二次免费机会，也不再展示第二个二维码、生成关注挑战或要求独立关注桥。

2026-08-25 只读生产核查确认登录页已经能够生成真实“派聪明”临时二维码，`/vip/claim` 也能展示邀请码输入入口；旧的 404 结论已经过期。下一次标准发布必须从 paicoding 环境读取真实桥接密钥和服务号 AppID，并保持 `PAICONGMING_WECHAT_LOGIN_ENABLED=true`。在使用新微信身份完成扫码回调、注册落库、邀请码核销和后续核心功能验收前，仍不能宣称完整流程已经可用。

`DEPLOY_STAGE` 表示“已经完成验收的最高业务阶段”，不是“此刻是否接新订单”。进入会员或市场阶段后，即使临时停单也不要退回 `free` 或关闭支付 Provider，否则会影响历史订单回调与对账。

## 轻量账号与进程身份

- MySQL 只新增一个 `pai_resume@localhost` 账号，不再拆应用、Flyway 和备份账号。应用与 Flyway 共用该账号并显式设置 `MYSQL_SHARED_ACCOUNT_CONFIRMED=true`；账号强制 TLS、最多 12 个连接，只拥有 `pai_resume.*` 库级权限。凭据由 `scripts/bootstrap-mysql-account.sh` 生成到 `/etc/pai-resume/mysql-app.env`，生产环境生成脚本只按数据解析，不从 paicoding 复制 root 凭据。
- 备份不经过应用账号。生产机由 Linux root 使用 MySQL 本地 Unix socket 导出 `pai_resume`，环境文件固定写入 `PAIRESUME_BACKUP_MYSQL_USERNAME=root` 和 `PAIRESUME_BACKUP_MYSQL_SOCKET=/var/lib/mysql/mysql.sock`，备份文件设为 `root:root 0600`；这两个变量不属于应用 datasource，MySQL root 密码不得进入 `/etc/pai-resume/pai-resume.env`、命令行、发布包或日志。
- Java 进程沿用现有 root 身份，不新建 Linux 系统用户。systemd 使用 `ProtectSystem=strict`、最小 `ReadWritePaths`、`PrivateTmp=true`、`NoNewPrivileges=true`、`-Xms128m -Xmx512m`、`MemoryMax=1024M` 和 `MemorySwapMax=0`；当前版本目录保持只读。
- 这是面向知识星球用户的小规模单实例方案：Hikari 最大连接数 `5`、最小空闲 `1`，Tomcat 最大线程 `48`、最大连接 `256`。不得因此扩大数据库授权、开放 3306 或把其他项目目录加入 `ReadWritePaths`。

`production-preflight.sh`、`StartupConfigValidator` 和 `ProductionFlywayGuard` 同时执行双重确认：只有应用与 Flyway 凭据相同且 `MYSQL_SHARED_ACCOUNT_CONFIRMED=true` 时才允许共用；三处均拒绝 root、空密码和未确认配置，不能通过关闭预检或 Flyway 绕过去。

## 私有 OSS 前置配置

私有 OSS 只用于简历照片，不用于人工精修 PDF。照片 OSS 的 Endpoint、Bucket 和 AccessKey 由 Admin 加密保存并独立启停；未配置时应用仍可启动，仅照片上传返回暂不可用。必须由独立运维身份完成下列配置：

1. Bucket ACL 设为 `private`，开启阻止公共访问，不绑定公开读 CDN 或公共读 Bucket Policy。
2. staging 与冻结对象前缀保持互不相同且互不包含，生产默认分别为 `pairesume/resume-review/staging/` 和 `pairesume/resume-review/objects/`。前缀必须是以 `/` 结尾的相对值，只能包含字母、数字、`/`、`_`、`-`，不能包含空白、反斜杠或 `//`；不得把其他项目对象放进这两个前缀。
3. 生产 CORS 只允许来源 `https://resume.paicoding.com`。私有照片使用 `POST`、`GET`、`HEAD`，其中读取必须携带服务端签发的短期 OSS URL。
4. 照片 staging 和固化对象使用独立前缀与生命周期规则。
5. 应用凭据使用独立 RAM 用户或角色，不授予 `AliyunOSSFullAccess`、`oss:*`、`ListObjects`、`oss:DeleteObject`、Bucket ACL/CORS/生命周期修改权限。`CopyObject` 在同一 Bucket 内需要源对象 `oss:GetObject` 和目标对象 `oss:PutObject`；staging 与冻结对象均由 Bucket 生命周期规则删除，不需要给应用删除权限，因此最小对象策略可按实际 Bucket 和两个前缀填写：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:GetObject",
        "oss:PutObject"
      ],
      "Resource": [
        "acs:oss:*:*:<private-bucket>/pairesume/resume-review/staging/*",
        "acs:oss:*:*:<private-bucket>/pairesume/resume-review/objects/*"
      ]
    }
  ]
}
```

6. AccessKey ID 与 Secret 只写入权限受限的 `/etc/pai-resume/pai-resume.env`，不得进入 `dist`、发布包、日志或截图。POST 直传响应只按协议返回非秘密的 AccessKey ID；AccessKey Secret 和长期密钥对永远不得返回浏览器。若主机支持 ECS RAM 角色，应后续改用角色短期凭据并移除长期 AccessKey。
7. 人工精修 PDF 通过同源后端 `multipart/form-data` 接收，单文件上限 10 MiB；服务端在内存中复核文件名、大小、MIME、文件头和 SHA-256 后直接发邮件。

简历照片额外使用 `pairesume/resume-photo/staging/` 与 `pairesume/resume-photo/objects/`。浏览器和服务端均校验 PNG/JPEG、3 MiB 上限、SHA-256、文件头、单边 4096 像素及总像素 1600 万；数据库只保存 `resume_photo.id`。照片对象不设置自动到期生命周期，账号注销时由应用删除，因此应用 RAM 只需额外获得照片两个前缀的 `oss:GetObject`、`oss:PutObject` 和 `oss:DeleteObject`，不能获得其他前缀删除权限。照片 staging 仍必须配置最迟 1 天清理。

OSS 生命周期按前缀工作且规则生效、执行存在时间差，不能把 30 分钟 `READY` 票据失效等同于对象已经删除。相关配置原理可核对阿里云官方的 [CORS 配置说明](https://help.aliyun.com/zh/oss/user-guide/configure-cross-origin-resource-sharing)、[生命周期说明](https://help.aliyun.com/zh/oss/user-guide/overview-54)、[RAM 最小权限示例](https://help.aliyun.com/zh/oss/user-guide/ram-policy/) 和 [CopyObject 权限表](https://help.aliyun.com/zh/oss/developer-reference/copyobject)。

人工精修的生产预检只要求真实 SMTP、admin 配置的私密收件箱与 Message-ID 域名，不要求人工精修 OSS 变量。

## 主机前置准备

- 不创建 `pai-resume` Linux 用户或用户组；systemd 服务使用现有 root 身份，并依靠 unit 沙箱约束文件系统写入和内存。
- 创建 `/home/www/pairesume/bin`、`/home/www/pairesume/incoming`、`/home/www/pairesume/releases`、`/home/www/pairesume/failed`、`/etc/pai-resume`、`/var/log/pai-resume` 和 `/var/backups/pai-resume`；均由 root 管理，环境文件和备份文件为 `root:root 0600`。
- 小规模知识星球灰度先使用 Hikari `5/1`（最大连接/最小空闲）、Tomcat `48/4`（最大线程/最小空闲）、`256` 最大连接和 `32` accept queue；生产预检校验这些参数及其大小关系，后续只根据真实监控逐步调整。
- 把当前版本的 `production-preflight.sh`、远端激活和回滚脚本安装到不随版本软链接切换的 `/home/www/pairesume/bin`，归 root 所有并设为 `0755`。systemd 与回滚始终调用这份稳定控制脚本，不依赖目标旧版本是否包含预检脚本。
- 首次启动前执行 `nginx -t` 和 `systemd-analyze verify`，核对 unit 的 root 运行身份、只读版本目录、`ReadWritePaths` 与 `MemoryMax`；目录或权限不符时不得继续切换版本。

## 发布前顺序

1. 从确定的提交或标签在本机启动固定版本的 Linux builder；明确选择 working-tree 模式时，把基准提交、dirty 标记和内容摘要写入 manifest。生产机不执行 `git pull`、npm 或 Maven 构建。
2. 构建环境只加载前端公开变量，运行前后端完整测试和构建。真实 `VITE_SUPPORT_EMAIL`、`VITE_OPERATOR_NAME`、`VITE_AI_PROVIDER_NAME` 和 `VITE_AI_PROVIDER_PRIVACY_URL` 必须在 `npm run build` 前注入；数据库、JWT、支付和 AI API Key 不进入构建包。
3. 组装最小 Linux 发布包，固定制品契约只有完整 `dist/`、后端 JAR、`config/`、manifest 和 checksum。生产包不包含 Node、`node_modules`、PDF worker、源码或 macOS 架构产物。
4. 在构建环境中完成浏览器 PDF 导出测试、临时空库 Flyway 迁移、前后端测试、manifest 和 SHA-256；再用最近一次生产备份的副本完成恢复演练。人工精修的 PDF 附件投递另按真实验收清单留证。
5. 一键发布脚本先把发布包上传到 `/home/www/pairesume/incoming/*.partial`，上传和 checksum 完成后才原子改名。发布包不得包含 `.env`、密钥、日志、测试数据或 Git 元数据。
6. 远端稳定激活脚本校验 checksum、manifest、目标架构和压缩包路径安全，解压到 `releases/.staging-*`；Linux root 通过本地 MySQL socket 备份 `pai_resume`，再执行候选版本生产预检并原子切换 `current`。
7. systemd 以受沙箱限制的 root 身份、明确 Java 17、`-Xms128m -Xmx512m` 和 `MemoryMax=1024M` 只重启 `pai-resume`，随后验证本机 health/ready 和公网 `scripts/smoke-production.sh`。日常应用发布不修改或 reload Nginx，不重启 MySQL、Redis、paicoding、PaiSmart、javabetter 等已有服务。失败时只切回代码与静态资源，不自动恢复数据库。

Nginx 站点的首次安装、证书链修复或 Nginx 配置变更属于独立运维动作，必须先 `nginx -t` 再受控 reload；不能夹在日常 PaiResume 应用发布中执行。

编辑器的“预览与导出”会在同域 iframe 中加载 `/preview/:id`。Nginx 对其他页面继续返回
`X-Frame-Options: DENY`，仅该预览路径返回 `SAMEORIGIN`；不得将站点整体改成允许跨域嵌入。

`bootstrap-production-env.sh` 可通过 `PAIRESUME_SUPPORT_EMAIL` 接收与前端制品一致的公开客服邮箱；重复执行时若未显式传入，会保留目标环境文件中已有的 `VITE_SUPPORT_EMAIL`，不会退回 SMTP 发件地址或静默改值。公开客服邮箱不是秘密，但仍不得把 SMTP 密码或其他凭据写进命令输出。

## 回滚

保留至少两个完整版本目录。应用发布失败时，用稳定控制目录中的 `/home/www/pairesume/bin` 脚本校验并切回上一版本；目标版本无需自带新版预检脚本。数据库迁移必须保持向前兼容；需要回退数据时，只能使用演练过的备份恢复流程，禁止直接删除 Flyway 历史或手工回滚未知 SQL。

当前数据库迁移不创建存储过程或函数；备份脚本会备份表结构、表数据、触发器和事件，但不包含存储过程/函数。若未来引入数据库例程，必须同步升级并重新演练备份参数。

## 外部人工验收

- 域名解析、HTTPS 证书与自动续期。
- 备案、经营主体、微信商户和其他适用资质。
- 防火墙、Nginx、SSE 长连接、日志轮转及告警通知人。
- SMTP 的 SPF、DKIM、DMARC，以及主流邮箱真实投递。
- SMTP 端口 465 只允许隐式 TLS（`MAIL_SSL_ENABLE=true`、STARTTLS 两项为 `false`）；587 只允许 STARTTLS（SSL 为 `false`、STARTTLS 两项为 `true`），不得同时开启两种握手模式。
- 派聪明服务号临时二维码生成、未关注扫码、已关注扫码、重复回调、过期挑战、一次性换票和注销重新扫码；同时验证 paicoding 回调签名和双方重放保护。
- 使用真实知识星球批次码验收 `/vip/claim`：输入邀请码不占名额，新用户扫码后先确认协议再领取，已有登录用户直接领取，二维码更新后旧码不能绑定，重复完成不重复核销，过期/作废/耗尽均失败且不泄露具体状态。
- 部署常驻人工精修前，使用测试简历跑通浏览器导出 PDF、后台配置收件箱、会员免费排队、可选加急、PDF 内存校验、SMTP 接受后入队、公开脱敏队列、后台处理与数据注销边界。验证整个过程不写服务器本地 PDF，也不产生人工精修 OSS 请求。
- 使用真实客服邮箱、运营主体和当前 AI 服务商披露重新构建前端，并真实验证客服邮箱收发与值守；只修改运行时环境文件不会改变已经生成的 `dist`。
- 会员支付开放前，微信支付回调公网可达并完成 `checklists/wechat-payment-acceptance.md` 全部场景。
- 会员月卡、季卡、年卡和终身会员由 `membership_plan` 统一管理；新迁移只继承并启用已有年卡价格，其余方案必须由管理员配置真实价格后逐项启用。邀请码权益天数仍由后台逐批配置，不能复用付费方案。
- 生产部署前完成 `checklists/resume-review-acceptance.md`；未完成时不得发布常驻人工精修版本，不能用价格 `0` 或隐藏入口替代验收。
- 用户简历市场开放前，再完成 `checklists/marketplace-payment-acceptance.md` 的真实市场订单、退款反冲、作者收益、结算和治理值守验收。
