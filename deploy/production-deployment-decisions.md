# 派简历生产部署已确认决策

更新时间：2026-07-24

本文记录当前已经确认的生产部署方向、需要解释的业务关系和仍待实现的事项。本文不保存任何服务器私钥、数据库密码、微信商户参数、AI API Key 或其他秘密值。

## 一、已确认的资源边界

| 项目 | 已确认决策 |
| --- | --- |
| 生产目录 | 固定使用 `/home/www/pairesume` |
| MySQL | 复用现有 MySQL 8 进程；新增 `pai_resume` 数据库和唯一的 `pai_resume@localhost` 账号，应用与 Flyway 共用，备份仍由 Linux root 通过本地 socket 执行 |
| 微信支付 | 复用现有商户主体和底层商户凭据；PaiResume 的回调、订单前缀、开关、对账和退款审计独立 |
| 派聪明登录 | 目标仍为 paicoding HMAC 扫码桥；首发因生产 endpoint 为 404 且本次不影响 paicoding，暂时关闭扫码并保留邮箱兼容登录 |
| Redis | 本次不重启、不迁移现有手工进程；复用 `127.0.0.1:6388`，使用独立 DB 1 和 `pairesume:prod:` 前缀，systemd 纳管另开维护窗口 |
| 人工精修 PDF | 提交时经后端内存校验后作为附件直接投递到 admin 配置的邮箱，不使用 OSS，不写本地磁盘 |
| AI 服务商 | 首发从权限受限环境文件读取 DeepSeek 配置；管理后台加密配置仍是后续待办 |
| Nginx | 复用现有 Nginx，新增 `resume.paicoding.com` 独立站点，静态目录为 `/home/www/pairesume/current/dist` |
| DNS | `resume.paicoding.com` 已解析到当前生产机 |
| Java | 显式使用现有 Java 17；知识星球小规模首发使用 `-Xms128m -Xmx512m`、`MemoryMax=1024M`、`MemorySwapMax=0` |
| Linux 身份 | 不新增 `pai-resume` 系统用户；systemd 沿用 root，并用 `ProtectSystem`、最小 `ReadWritePaths` 和 `MemoryMax` 限制影响范围 |
| 构建 | 本地受控 Linux 构建环境完成测试和制品组装；生产机不运行 npm/Maven 构建 |
| Node.js | 生产环境完全不需要 Node：不全局安装、不随包携带，也不启动 Node 进程；PDF 在浏览器生成 |
| 发布入口 | 一条命令体验参考 paicoding 的 `launch.sh`；本地构建并上传，远端只负责验包、切换、systemd 重启、健康检查和回滚 |
| 监控和备份 | 新增 PaiResume 独立日志、告警标签、数据库备份、异机副本和恢复演练 |

### Redis systemd 现场核查

2026-07-24 只读核查确认：

- 当前 Redis 7.2.6 进程由 root 手工启动，属于登录 session 的 cgroup，不属于 `redis.service`。
- 监听 `127.0.0.1:6388`，配置文件和 RDB 数据当前位于 `/root/soft/redis`。
- `redis.service` 已设置 enabled，但状态为 inactive；unit 使用 `Type=forking`，而配置为 `daemonize yes`、`supervised no`。
- 现有 `ExecStop=/usr/bin/redis-cli shutdown` 没有指定 6388，也没有认证处理，不能正确停止当前实例。
- 当前使用 RDB，AOF 关闭；现场 `dump.rdb` 约 80 MB 且仍在更新。

所以不能直接运行 `systemctl start redis`：它会尝试用同一份配置再启动一个进程并争抢 6388，停止命令也可能误操作默认端口。

纳入 systemd 需要维护窗口，目标步骤为：

1. 使用现有认证方式执行 `BGSAVE`，等待成功后复制 RDB、生成 checksum，并记录回滚启动方式；全过程不在终端或日志输出密码。
2. 准备 systemd 前台运行配置，使用 `daemonize no`、`supervised systemd`，停止时向 systemd 跟踪的主 PID 发送正常 `SIGTERM`，不再调用默认端口的裸 `redis-cli shutdown`。
3. 长期应把配置和数据从 `/root/soft/redis` 迁到 `/etc/redis` 与 `/var/lib/redis-6388`，由不可登录 Redis 用户运行；若本周末分阶段处理，也必须明确记录 root 运行只是临时过渡。
4. 停止手工进程后确认 6388 已释放，再启动 unit；核对 cgroup、监听地址、DB 0/DB 1 键数量、TTL、RDB 状态和依赖项目连接。
5. 任一检查失败立即停止新 unit，恢复原配置和备份，再按已记录的旧方式启动；不能在没有备份的情况下反复启停。

Redis 纳管会短暂影响 paicoding、PaiSmart 等共享该实例的项目，因此必须单独取得执行授权并安排低峰维护窗口，本轮没有重启或修改 Redis。

## 二、轻量账号方案与风险边界

### MySQL 账号

现场发现 paicoding 实际使用 `root@localhost` 空密码，且没有可复用的非 root 账号。为避免 PaiResume 继承整台 MySQL 的超级权限，用户随后授权只创建一个轻量账号：

1. `pai_resume@localhost` 使用 `caching_sha2_password`、强密码和 `REQUIRE SSL`，最多 12 个并发连接。
2. 账号只在 `pai_resume.*` 上拥有库级权限；应用与 Flyway 共用该账号并设置 `MYSQL_SHARED_ACCOUNT_CONFIRMED=true`，不再拆多套账号。
3. 凭据由 `scripts/bootstrap-mysql-account.sh` 自动生成，保存在 `/etc/pai-resume/mysql-app.env`，文件为 `root:root 0600`；脚本重复执行只校验，不输出或轮换密码。
4. 备份由 Linux root 通过 `/var/lib/mysql/mysql.sock` 执行，MySQL root 密码不写入 PaiResume 环境、发布包、命令行或日志。
5. 2026-07-24 已真实验证：新账号强制 TLS、最大连接数 12、在 `pai_resume` 有 18 项库级权限、其他数据库权限为 0。

`scripts/production-preflight.sh`、`StartupConfigValidator` 和 `ProductionFlywayGuard` 继续硬拒绝 root、空密码和未确认的共用账号配置。

### Linux 运行身份

本次不创建 `pai-resume` Linux 系统用户，Java 进程由 systemd 沿用 root 身份。为避免影响服务器现有项目，unit 必须同时满足：

- `ProtectSystem=strict`，`/home/www/pairesume/current` 保持只读。
- `ProtectHome=read-only`，保证能够读取 `/home/www/pairesume` 但不能写其他 `/home` 内容。
- `ReadWritePaths` 只允许 PaiResume 独立日志目录和私有临时目录，不包含 paicoding、PaiSmart、javabetter、Nginx、MySQL 或 Redis 的目录。
- `PrivateTmp=true`、`NoNewPrivileges=true`，把临时文件和子进程限制在同一服务边界内。
- Java 堆使用 `-Xms128m -Xmx512m`，systemd 使用 `MemoryMax=1024M`、`MemorySwapMax=0`，防止异常负载挤压已有服务。
- 日常发布只执行 `systemctl restart pai-resume`；不 restart/reload 其他应用、MySQL、Redis 或 Nginx。

root 加 systemd 沙箱的隔离能力仍弱于独立不可登录用户，这是已明确接受的剩余风险。发布脚本和服务不得据此获得其他项目目录的写权限。

## 三、什么是“派聪明扫码桥”

“桥”不是新的公众号，而是 paicoding 与 PaiResume 之间的一小段受认证服务端通信。

现有“派聪明”公众号的 AppSecret 和 access_token 由 paicoding 持有。为了避免 PaiResume 再保存一套公众号核心凭据，扫码登录按下面的数据流工作：

```text
PaiResume
  ── HMAC 签名请求 ──> paicoding
  ── 生成临时二维码 ──> 微信服务号接口

用户扫码
  ── 微信事件 ──> paicoding
  ── HMAC 签名事件 ──> PaiResume
  ── 匹配一次性 challenge ──> 注册或登录
```

桥接层负责：

- 代 PaiResume 调用微信临时二维码接口。
- 接收微信扫码、关注和重复回调。
- 给双方请求加时间戳、nonce、HMAC 和重放保护。
- 只传递 PaiResume 完成登录所需的最小事件。

PaiResume 只保存 AppID、网关地址和双方共享的独立 HMAC 密钥，不保存“派聪明”的 AppSecret/access_token。

以下是 2026-07-24 首次部署时的历史状态，已被 2026-08-25 的核心灰度决策替代：PaiResume 侧接收和校验代码已经存在，但当时 paicoding 生产桥接 endpoint 仍返回 404，尚未完成对应桥接代码发布和双方真实参数配置。因此当时：

- `PAICONGMING_WECHAT_LOGIN_ENABLED=false`。
- `PAICONGMING_WECHAT_BRIDGE_SECRET` 和 `PAICONGMING_WECHAT_APP_ID` 留空，不填假值。
- 保留邮箱兼容登录。首次生产浏览器验收发现登录页仍会先展示扫码区，在 challenge 接口返回 503 后提示“扫码登录暂不可用”，邮箱密码表单可正常展开；这是已记录的首发体验待办，不能据此宣称扫码登录可用。
- 依赖扫码绑定的新用户邀请码领取暂不开放。

该历史例外不再适用于下一次生产发布。当前生产已经可以生成派聪明临时二维码，但仍需按核心验收清单完成扫码回调、注册落库、知识星球 VIP 开通、编辑、导出和 AI 分析。

## 四、人工精修不再接入第二座公众号桥

2026-08-25 产品规则更新：人工精修作为 VIP 会员权益，有效会员可以免费排队，非会员必须先开通会员；会员可自愿支付加急金额，加急金额越高等待位置越靠前，不再设置人工精修基础价或首份次数规则。

因此不再展示第二个二维码，不生成关注挑战，不接收独立关注回调，不配置第二把公众号桥 HMAC 密钥，也不再提供后台关注故障兜底码。“派聪明”仍只承担注册和登录，不参与人工精修权益核销。

旧迁移中已经出现的关注挑战、事件和权益类型只为兼容已有数据库与 Flyway 校验暂时保留；运行时不再签发或消费这些数据。`V22__retire_resume_review_follow_flow.sql` 会把尚未使用的挑战码和后台兜底码统一置为失效，但不删除历史行或奖励记录。后续若确认所有环境均未产生历史记录，可另行编写向前迁移清理，不能直接改写已经执行过的 Flyway 文件。

## 五、零 Node 与人工精修 PDF 边界

前端 `dist` 完全在本地构建，生产机不执行 `npm install`、Vite 或任何 Node 命令，发布包也不携带 Node、`node_modules`、PDF worker 或根目录 `public/fonts`。Vite 产出的完整 `dist/` 已包含浏览器所需字体和静态资源。

PDF 路径已经统一为：

1. 用户普通下载由浏览器生成 PDF，不再请求服务端运行渲染器。
2. 人工精修由用户直接选择已经导出的本地 PDF。创建申请只记录文件名、大小和 SHA-256；用户点击发送时，后端在内存中复核文件名、大小、MIME、`%PDF-` 文件头和 SHA-256，然后作为附件直接投递。
3. 服务端不接收任意 URL、本地路径、对象键或收件人；上传完成后从 OSS 流式读取 staging 一次，复核类型、大小、完整 SHA-256 和 `%PDF-` 文件头，并按源 ETag 在 OSS 内复制到随机冻结对象。全局默认最多 4 路完成冻结，允许配置 1 至 16；超出立即返回 503，不排队占用数据库连接。staging 不在业务事务中立即删除，避免 OSS 复制成功而数据库事务失败时失去重试源，最迟由独立短生命周期规则清理。
4. 浏览器只会获得 POST 表单所需的非秘密 AccessKey ID，永远拿不到 AccessKey Secret 或长期密钥对；staging 与冻结对象使用独立前缀、最小权限凭据和生命周期清理。
5. 邮件 outbox 由单 worker 顺序处理；每次发信时服务端把受大小上限保护的冻结 PDF 临时读取一次到 JVM 内存并复核完整 SHA-256，不写服务器本地 PDF。确定性附件校验失败或自动投递达到 `RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS` 后停止自动重试，管理员仍可手动重试或退回；生产发布包固定只包含完整 `dist/`、后端 JAR、`config/`、manifest 和 checksum。

2026-08-25 决策更新：人工精修改为常驻会员服务，不再使用业务总开关或新单开关。导航、排版导出入口和公开脱敏队列始终存在；免费排队需要有效会员，加急支付是可选能力。生产部署必须具备后台可配置的私密收件箱和真实 SMTP；人工精修 PDF 不使用 OSS。开放加急前还必须具备真实微信支付。必须用测试 PDF 验证后端内存核验、邮件附件、失败重试、SMTP 接受后入队、加急排序和公开脱敏队列；不得用真实用户简历做自动化冒烟数据。

2026-08-25 核心灰度优先级更新：知识星球会员首先通过派聪明扫码注册/登录和 `/vip/claim` 开通 VIP，再完成简历编辑、排版导出与 AI 分析。只读生产核查已经确认登录二维码能够生成、邀请码页面能够打开，但尚未用新微信身份完成扫码回调和后续真实操作。下一次发布必须保持扫码登录启用，并以 `deploy/checklists/planet-core-acceptance.md` 的真实证据作为 `PLANET_CORE_ACCEPTANCE_CONFIRMED=true` 的前提。

上传授权与完成冻结按 action 使用独立计数，并同时受账号/IP 双预算限制；生产默认 900 秒窗口、每账号 20 次、每 IP 200 次。预检限制窗口为 60 至 3600 秒、账号预算为 1 至 100、IP 预算为 1 至 2000，并要求 IP 预算不小于账号预算。

## 六、后台 AI 服务商配置的安全要求

当前代码只从 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` 和 `AI_ANALYSIS_MODEL` 环境变量读取配置，管理后台暂时只能修改价格，尚不能配置 AI 服务商。

目标实现至少包含：

- 管理端字段：服务商显示名称、Base URL、通用模型、分析模型、API Key、隐私政策 URL、启用状态。
- API Key 使用 AES-GCM 等认证加密后落库；主加密密钥只放在权限为 `0600` 的生产环境文件中。
- 查询接口只返回 `configured=true/false` 和掩码，不返回密文或明文。
- 更新时空 API Key 表示保留原值；显式替换才轮换密钥。
- 日志、异常、审计表和前端状态都不得记录完整 API Key。
- 提供仅管理员可调用的连接测试，响应只显示成功、失败类型和上游状态，不回显请求头或完整上游响应。
- AI 调用每次动态读取当前有效配置或读取可安全失效的短缓存，不能继续只靠启动时注入的 `@Value`。
- 切换实际 AI 服务商时，同步更新用户可见的服务商名称、隐私政策和协议版本，不能只换 Key。

这部分在实现并完成安全测试前属于上线待办，不能因本文记录了目标方案就宣称后台已经支持。

## 七、目标一键发布过程

一键入口放在本地 PaiResume 仓库根目录，命令体验参考 paicoding：

```bash
./launch.sh deploy <tag-or-commit>
./launch.sh status
./launch.sh rollback
```

`deploy` 的目标过程：

```text
确认代码版本和工作区；working-tree 模式记录基准提交、dirty 标记和内容摘要
→ Linux 构建环境执行前后端完整测试
→ 构建完整 dist、JAR、config 和 manifest
→ 生成 manifest 与 SHA-256
→ 上传到 /home/www/pairesume/incoming/*.partial
→ 上传完成后原子改名
→ 远端校验压缩包、checksum、CPU 架构和目录穿越
→ 备份 pai_resume 数据库
→ 解压到 releases/.staging-*
→ 生产预检
→ 原子切换 current
→ 只执行 systemd restart pai-resume
→ 本机 health/ready 与公网 smoke
→ 失败时切回 previous 并重新验证
```

生产机不执行 `git pull`、npm 或 Maven 构建，不保留 GitHub 工作区。发布包不得包含 `.env`、生产密钥、日志、测试数据或 Git 元数据。

Nginx 站点首次安装、证书链修复或配置变化时，必须把 `nginx -t` 和受控 reload 作为独立运维动作执行。普通 PaiResume 应用发布不得修改或 reload Nginx，避免干扰共享 Nginx 上的已有站点。

数据库迁移不能随代码失败自动恢复。自动回滚只切回代码和静态资源；数据库恢复必须人工确认，避免覆盖发布期间新增的真实数据。

## 八、目标生产目录

```text
/home/www/pairesume/
├── bin/
│   ├── activate-release.sh
│   ├── production-preflight.sh
│   └── smoke-production.sh
├── incoming/
├── releases/
├── current -> releases/<release>
├── previous -> releases/<release>
├── failed/
└── deploy.lock

/etc/pai-resume/pai-resume.env
/var/log/pai-resume/
/var/backups/pai-resume/
```

## 九、证书续期核查结论

2026-07-24 已对生产机完成核查和受控修复，未读取或输出证书私钥内容：

1. acme.sh 的每日 00:03 Cron 与 Cron 服务正常。
2. acme.sh 源目录中的通配符证书已经自动续期，有效期至 2026-10-08。
3. 修复前缺少安装到 Nginx 实际路径和 reload hook；旧证书已备份到 `/var/backups/pai-resume/nginx-cert-before-20260724T014121Z`。
4. 已使用 acme.sh 安装新通配符证书并补 reload hook，`nginx -t` 通过，受控 reload 成功；当前证书有效期至 2026-10-08。
5. 整个过程没有重启 Nginx、MySQL、Redis、paicoding、PaiSmart 或 javabetter。

当前续期闭环为：

```text
acme.sh 续期
→ install-cert 到 Nginx 实际路径
→ nginx -t
→ systemctl reload nginx
→ 核对线上 SNI 证书
→ 失败日志和告警
```

## 十、首次生产发布结果

2026-07-24 已完成首次封闭生产发布：

- 生产地址：`https://resume.paicoding.com`
- 当前版本：`6a8c5345beac-20260724T025733Z`
- 当前链接：`/home/www/pairesume/current -> /home/www/pairesume/releases/6a8c5345beac-20260724T025733Z`
- 应用状态：`pai-resume.service` 为 `active/enabled`，只监听 `127.0.0.1:8084`；`/api/health` 和 `/api/ready` 均为 `UP`。
- 资源边界：Java `-Xms128m -Xmx512m`，systemd `MemoryMax=1 GiB`、`MemorySwapMax=0`、`TasksMax=128`、`CPUWeight=25`、`IOWeight=25`、`Nice=5`。
- 数据库：生产库 35 张表，Flyway 最新版本 23；应用与 Flyway 均使用唯一的 `pai_resume@localhost` TLS 账号。
- 运维 timer：`pai-resume-mysql-backup.timer` 每日执行，`pai-resume-ready-check.timer` 每 5 分钟执行，二者均为 `active/enabled`。
- 生产备份：发布后已生成包含迁移结果的 `/var/backups/pai-resume/pai_resume-20260724T030947Z.sql.gz`；此前已在隔离临时库完成一次备份、SHA-256 校验、恢复核对并立即删除临时库。
- HTTPS：HTTP 固定 301 到 HTTPS；线上证书覆盖 `*.paicoding.com`，有效期至 2026-10-08；哈希静态资源返回 `immutable` 缓存。
- Nginx：SPA 回退、安全响应头、私有路由 `noindex` 和 API 反代均通过公网 smoke。首次配置只执行通过 `nginx -t` 的平滑 reload，Nginx 主 PID 保持不变。
- 历史首发状态：`DEPLOY_STAGE=free`、`PAYMENT_PROVIDER=disabled`、会员新单关闭、用户市场关闭、人工精修及 OSS 关闭、派聪明扫码桥关闭；Redis 使用 DB 1 和 `pairesume:prod:`。该状态早于 2026-08-25 常驻人工精修决策，不能直接用于部署新版本。
- 浏览器验收：首页、隐私政策、邮箱登录表单和未登录访问私有路由的跳转正常；匿名页面固定会出现 `/api/auth/refresh` 的 401，扫码桥关闭时 `/api/auth/wechat/challenges` 返回 503，均为已确认的降级请求，没有静态资源失败。
- 兼容性回归：`paicoding.com`、`smart.paicoding.com`、`javabetter.cn` 和 `ai.javabetter.cn` 均返回 200；MySQL、Redis、paicoding、PaiSmart 和 Nginx 的既有 PID 在发布前后未变化。
- 3306 边界：腾讯云“全部 IPv4、TCP 3306、拒绝”规则已生效；[Check-Host 报告](https://check-host.net/check-report/45460e09k163)中的德国、芬兰、以色列、印度和越南节点均超时，配合服务器抓包未见入站探测 SYN。本地 `127.0.0.1` 上应用账号仍可通过 TLS 访问 MySQL。
- 密钥权限：生产环境文件、MySQL 凭据、专用 truststore 和发布锁均为 `root:root 0600`，秘密值未写入发布包或本文。

2026-07-27 复查发现，生产 Nginx 对 `/preview/:id` 也返回了全局
`X-Frame-Options: DENY`，与编辑器的同域预览 iframe 冲突。仓库模板已收紧为仅该路径返回
`SAMEORIGIN`、其他路径继续 `DENY`；该修复仍需单独执行 `nginx -t`、受控 reload 和公网冒烟，
不能随普通应用发布静默修改共享 Nginx。

首次发布没有旧的成功版本，因此当前不存在 `previous` 软链接。不能把 `./launch.sh rollback` 当成首版兜底；若首版必须下线，应停止 `pai-resume.service` 并由受控运维操作取消 `current`，或发布一个新的已验证版本。第二次成功发布后，脚本才会保留可一键切回的上一版本。

## 十一、当前完成状态

- [x] 已创建空的 `pai_resume` 数据库和唯一的 `pai_resume@localhost` 账号；强制 TLS、最多 12 个连接，只授权 `pai_resume.*`。
- [x] 生产预检、启动校验和 Flyway guard 已统一要求同一非 root 强密码账号及 `MYSQL_SHARED_ACCOUNT_CONFIRMED=true`，对应测试通过。
- [x] 使用 Linux root 通过本地 MySQL socket 完成 `pai_resume` 备份、权限核对、校验和隔离临时库恢复演练。
- [ ] 将现有 Redis 进程纳入 systemd；该动作会影响共享服务，明确移出本次首发，另开维护窗口。
- [x] 在本地应用配置、生产环境示例和预检中接入独立 Redis DB 1。
- [x] 在代码中加入 `pairesume:prod:` 统一 Redis 键前缀并完成 Redis 相关回归测试。
- [ ] 实现管理后台 AI 服务商配置、加密存储、掩码回显、连接测试和审计。
- [ ] 发布 paicoding 的派聪明扫码桥并完成真实扫码验收。
- [x] 删除第二座公众号桥、第二个二维码和首份次数规则；人工精修改为会员免费排队、可选付费加急。
- [x] 本地代码和发布包边界已改为浏览器普通导出、人工精修 PDF 内存校验与邮件附件投递，不使用人工精修 OSS，不依赖 Node/PDF worker。
- [ ] 使用测试 PDF 完成真实 SMTP 附件投递、失败重试和邮件接受后入队验收。
- [x] 本地 `launch.sh`、本机构建、上传和远端激活/回滚脚本已经实现；最终工作树制品已构建并成功激活版本 `6a8c5345beac-20260724T025733Z`。
- [x] 将本地部署说明、生产环境示例、systemd 和 Nginx 模板迁移到 `/home/www/pairesume`。
- [x] 已将稳定控制脚本、Nginx 站点和 PaiResume 独立 systemd unit/timer 安装到生产机，并完成真实一键发布演练。
- [x] 已安装 systemd 模板：沿用 root、Java 17、`-Xms128m -Xmx512m`、`MemoryMax=1024M`、`MemorySwapMax=0`、`ProtectSystem=strict` 和最小 `ReadWritePaths`；发布只重启 `pai-resume`。
- [x] 更新本地 Nginx 模板：独立站点、SPA 回退、安全头、共享证书和 `127.0.0.1:8084` 反代。
- [x] 只读核对通配符证书的续期、安装与 reload 现状。
- [x] 已修复通配符证书的自动安装与 Nginx reload，并完成线上证书切换验收。
- [ ] 每日数据库备份、就绪探测和恢复演练已完成；日志轮转、资源/磁盘/数据库告警、告警送达及异机副本仍待补齐。
- [x] `resume.paicoding.com` DNS 已解析到当前生产机。
- [x] 腾讯云已拒绝公网 TCP 3306；五个外部节点复测均超时，服务器抓包未见探测 SYN，本机 MySQL TLS 连接正常。
- [x] 已在所有支付、新单、用户市场、人工精修和扫码桥开关闭合的情况下完成首次封闭生产部署及公网 smoke。

## 本地开发快照（2026-08-19，未部署生产）

- 生产仍为 2026-07-24 首发版本 `6a8c5345beac-20260724T025733Z`（数据库 V23）；本节只记录本地仓库状态，不改变上述生产事实。
- 本地迁移已推进到 V31：V30 分求职场景分析提示词（四场景种子 + `resume_analysis_record.scenario_code` 与索引），V31 AI 服务商安全配置（单行配置表 + 审计表，AES-256-GCM 密钥加密，主密钥来自 `AI_PROVIDER_MASTER_KEY`）。V31 启用前必须在生产 0600 环境文件配置主密钥。
- 全量测试快照：后端 `mvn test` 538 项通过、1 项 opt-in 真实迁移跳过；前端 Vitest 117 项、node 单元 99 项、Playwright E2E 6 项通过（E2E 需本地前后端，未接入 CI）。
- 支付、人工精修、用户市场与扫码桥开关仍保持关闭；第二次发布前需按发布脚本演练回滚（首个版本尚无 previous 目标）。
