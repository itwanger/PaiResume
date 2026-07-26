# PaiResume

PaiResume 是一个面向中文简历场景的在线简历编辑器，采用前后端分离架构，支持账号体系、模块化简历编辑、实时预览、Markdown/TXT 简历导入、AI 优化与整份简历分析，以及 PDF 导出。

## 项目特性

- 派聪明服务号扫码注册/登录，兼容邮箱登录、找回密码、Token 刷新、退出登录与账号注销
- 简历列表管理：新建、重命名、删除
- 模块化简历编辑：基础信息、教育背景、实习经历、项目经历、专业技能、论文发表、科研经历、获奖情况
- 实时预览，编辑区与预览区联动
- 支持拖拽导入 Markdown / TXT 格式的结构化简历
- VIP 支持 AI 单模块优化
- VIP 支持整份简历分析与评分，支持自定义分析提示词
- 优质简历菜单：所有人可浏览缩略卡，每份由后台设置为公开查看或通过 VIP 权益解锁，详情权限由服务端校验
- 用户简历市场：作者可免费公开或按次定价；付费成功后永久解锁购买时的不可变版本，并进入作者收益账本
- 用户简历市场治理：先审后发、举报/侵权投诉、创作者申诉、平台下架/恢复与完整审计
- 知识星球 VIP 邀请码：支持批次生成、限额、截止时间、兑换记录、风控、审计、异常权益撤销和会员延期
- 内置“校园技术蓝”等多套推荐排版
- VIP 支持导出 PDF
- 提供健康检查与就绪检查接口
- 提供基础 SEO、CI 质量门禁以及 Nginx、systemd、备份恢复、回滚与生产预检材料
- 人工简历精修：首次免费，第二次及以后逐单付费

## 技术栈

### 前端

- React 18
- TypeScript
- Vite 6
- React Router 7
- Zustand
- Tailwind CSS
- Axios
- Framer Motion
- `@react-pdf/renderer`

### 后端

- Java 17
- Spring Boot 3.3
- Spring Security
- MyBatis-Plus
- MySQL
- Redis
- 阿里云 OSS（仅用于人工精修 PDF 私有直传与保留）
- JWT
- Knife4j / OpenAPI
- WebClient

## 项目结构

```text
PaiResume
├── config/
│   └── field-optimize-prompts.yml # 字段优化默认提示词配置
├── src/                          # 前端源码
│   ├── api/                      # 接口封装
│   ├── components/               # 页面组件、表单组件、预览组件
│   ├── pages/                    # 登录、注册、工作台、编辑页
│   ├── store/                    # Zustand 状态管理
│   ├── utils/                    # PDF 导出、Markdown 导入、模块内容处理等
│   └── types/                    # 类型定义
├── server/                       # Spring Boot 后端
│   ├── src/main/java/...         # Controller / Service / Config / Security
│   └── src/main/resources/       # application.yml / schema.sql
├── public/fonts/                 # PDF 导出使用的中文字体
└── .env.example                  # 前后端共用环境变量示例
```

## 本地启动

### 1. 准备环境

- Node.js 18+
- npm 9+
- Java 17
- Maven 3.9+
- MySQL 8.x
- Redis 6.x 或 7.x

### 2. 启动后端

在项目根目录准备环境变量：

```bash
cp .env.example .env
```

按实际情况修改根目录 `.env`，至少确认以下配置：

- `SERVER_PORT`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USERNAME`
- `MYSQL_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

启动服务：

```bash
cd server
mvn spring-boot:run
```

默认情况下：

- 后端地址：[http://localhost:8084/api](http://localhost:8084/api)
- 健康检查：[http://localhost:8084/api/health](http://localhost:8084/api/health)
- 就绪检查：[http://localhost:8084/api/ready](http://localhost:8084/api/ready)
- 接口文档：[http://localhost:8084/api/doc.html](http://localhost:8084/api/doc.html)

说明：

- 后端使用 Flyway 记录并执行版本化数据库迁移；全新空库和首次接入旧数据库都会从 V5 建立基线，再执行 `V6__ReconcilePaiResumeSchema` 创建或对齐基础结构，随后依次执行 V7 邀请码、V8 会员来源追踪/审计/异常撤销、V9 简历市场、V10 支付生命周期加固、V11 作者收益冻结/退款账务、V12 支付对账租约、V13 会员在线支付订单、V14 市场浏览量、V15 会员支付人工复核、V16 市场治理、V18 账号隐私/注销、V19 派聪明微信身份、V20 人工精修工作流、V21 匿名邀请码领取凭证、V22 关注奖励流程退役、V23 人工精修 OSS 直传和 V24 优质简历访问属性迁移。
- 当 `APP_ENV=development` 时，后端启动后会自动确保存在一个测试账号，默认是 `test@example.com / Test123456`，可通过 `DEV_ACCOUNT_EMAIL` 和 `DEV_ACCOUNT_PASSWORD` 覆盖。
- 同时会自动创建一个管理员账号：`admin@example.com / Admin123456`。
- 生产环境必须为 Flyway 配置独立的 DDL 迁移账号；应用运行账号只授予业务表所需的最小权限。
- 生产环境必须显式设置 `APP_ENV=production`、独立的 JWT/验证码密钥、TLS 数据库连接、Redis 密码、SMTP 和 HTTPS CORS，否则服务会拒绝启动。

### 3. 启动前端

在项目根目录执行：

```bash
npm install
npm run dev
```

默认情况下：

- 前端地址：[http://localhost:5173](http://localhost:5173)
- 前端会通过 Vite 代理把 `/api` 请求转发到后端

## 环境变量

### 根目录 `.env`

| 变量名 | 说明 |
| --- | --- |
| `VITE_REACT_APP_TITLE` / `VITE_PORT` / `VITE_API_BASE_URL` / `VITE_API_PROXY_TARGET` | 前端标题、端口与本地代理配置 |
| `VITE_APP_PUBLIC_URL` | 后台复制知识星球发布文案时使用的网站地址；生产必须设置为真实 HTTPS 公网地址 |
| `VITE_SUPPORT_EMAIL` | 对外私密客服邮箱，会显示在客服说明页；开放收款前必须配置并完成真实收发验证 |
| `VITE_OPERATOR_NAME` | 真实运营主体或个人信息处理者名称，会显示在隐私政策、服务条款和协议补签页；生产构建必填，不得使用产品名代替真实主体 |
| `VITE_AI_PROVIDER_NAME` / `VITE_AI_PROVIDER_PRIVACY_URL` | 当前实际接收简历片段的第三方 AI 服务商名称及其 HTTPS 隐私政策地址；更换服务商时必须重新构建前端并触发协议更新 |
| `APP_ENV` | 运行环境，默认 `development` |
| `APP_TIME_ZONE` | 固定为 `Asia/Shanghai`；JVM、Jackson 与 MySQL 会话统一使用该业务时区，其他值会拒绝启动 |
| `APP_PUBLIC_URL` | 项目公网地址，默认 `https://resume.paicoding.com`；用于验证码邮件中的安全链接 |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | 允许跨域来源 |
| `SERVER_PORT` | 后端端口，默认 `8084` |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USERNAME` / `MYSQL_PASSWORD` | MySQL 连接配置 |
| `FLYWAY_ENABLED` / `FLYWAY_USERNAME` / `FLYWAY_PASSWORD` | Flyway 开关与独立迁移账号；生产迁移账号负责 DDL，业务账号使用最小权限 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DATABASE` | Redis 连接与逻辑库配置；生产与其他项目复用进程时必须使用独立逻辑库 |
| `PAICONGMING_WECHAT_LOGIN_ENABLED` / `PAICONGMING_WECHAT_GATEWAY_BASE_URL` / `PAICONGMING_WECHAT_BRIDGE_SECRET` / `PAICONGMING_WECHAT_APP_ID` | 派聪明服务号扫码登录开关、paicoding 内部二维码网关、独立 HMAC 密钥和服务号 AppID；PaiResume 不保存 AppSecret/access_token |
| `VIP_INVITE_RATE_LIMIT_WINDOW_SECONDS` / `VIP_INVITE_RATE_LIMIT_ACCOUNT_ATTEMPTS` / `VIP_INVITE_RATE_LIMIT_IP_ATTEMPTS` | 邀请码兑换窗口及账号/IP 尝试次数限制 |
| `VIP_INVITE_CLAIM_TTL_SECONDS` / `VIP_INVITE_CLAIM_RETENTION_DAYS` | 未登录邀请码领取凭证的有效期与失败/过期记录保留期；默认分别为 `600` 秒和 `30` 天 |
| `JWT_SECRET` | JWT 密钥，生产环境必须替换 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_ANALYSIS_MODEL` | AI 服务配置 |
| `FIELD_OPTIMIZE_PROMPTS_FILE` | 字段优化默认提示词配置文件路径，默认 `config/field-optimize-prompts.yml` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` | SMTP 认证账号、客户端授权码和发件地址 |
| `PAYMENT_PROVIDER` | 会员与简历市场共用的支付提供方，默认 `disabled`；本地/测试可用 `mock`，生产禁止使用 mock |
| `DEPLOY_STAGE` | 生产预检的最高获批阶段：`free`、`membership`、`marketplace`；隔离真实支付验收另用 `membership-acceptance` / `marketplace-acceptance`，停单维护时不降级阶段 |
| `PAYMENT_ACCEPT_NEW_ORDERS` | 已废弃的旧总开关，必须保持 `false`；设为 `true` 时应用拒绝启动，防止升级配置误开两条业务线 |
| `MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS` / `MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS` | 会员支付与用户简历市场支付的独立开关，均默认 `false`；维护时关闭新订单不会停止回调和历史订单对账 |
| `MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED` / `MARKETPLACE_PAYMENT_ACCEPTANCE_CONFIRMED` / `MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED` | 生产预检用人工验收确认位；只有对应清单留存真实证据后才可设为 `true` |
| `PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED` | 仅隔离预发布环境执行真实小额支付验收时设为 `true`，正式开放态不依赖该临时确认位 |
| `PAYMENT_ORDER_EXPIRE_MINUTES` / `MARKETPLACE_PLATFORM_FEE_BPS` | 市场订单有效期与平台费率（基点）；平台费默认 `0` |
| `MEMBERSHIP_ORDER_EXPIRE_MINUTES` / `MEMBERSHIP_PAYMENT_DAYS` | 会员订单固定支付时限（必须为 `30` 分钟）与年费会员的权益天数（默认 `365` 天）；两者均保存为订单快照 |
| `MARKETPLACE_EARNING_HOLD_DAYS` | 作者收益退款观察期，默认 `7` 天；生产必须至少为 `1`，仅开发/E2E 可设为 `0` |
| `MARKETPLACE_PAID_RECONCILIATION_INTERVAL_MINUTES` / `MARKETPLACE_PAID_DUE_RECONCILIATION_RETRY_MINUTES` | 冻结期内已支付订单的稀疏查单间隔（默认 360 分钟）与到期最终验真失败后的重试间隔（默认 5 分钟） |
| `WECHAT_PAY_APP_ID` / `WECHAT_PAY_MERCHANT_ID` | 微信支付 AppID 与商户号 |
| `WECHAT_PAY_PRIVATE_KEY` / `WECHAT_PAY_MERCHANT_SERIAL_NUMBER` / `WECHAT_PAY_API_V3_KEY` | 微信支付 API v3 商户密钥、证书序列号与 API v3 Key；只配置在后端 |
| `WECHAT_PAY_NOTIFY_URL` | 微信支付回调公网 HTTPS 地址，必须精确指向 `/api/public/payments/wechat/notify` |
| `RESUME_REVIEW_RECIPIENT_EMAIL` / `RESUME_REVIEW_MESSAGE_ID_DOMAIN` | 人工精修服务的固定私密收件箱和稳定邮件 Message-ID 域；生产必填 |
| `RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS` | 人工精修邮件自动投递的最大尝试次数，默认 `10`，生产允许 `1` 至 `50`；确定性附件校验失败不继续自动重试 |
| `RESUME_REVIEW_UPLOAD_RATE_LIMIT_WINDOW_SECONDS` / `RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS` / `RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS` | 人工精修上传授权与完成冻结的限流窗口、账号预算和 IP 预算；默认 `900` 秒、每账号 `20` 次、每 IP `200` 次，`authorize` / `complete` 分动作计数且 IP 预算不得小于账号预算 |
| `RESUME_REVIEW_OSS_ENABLED` / `RESUME_REVIEW_OSS_ENDPOINT` / `RESUME_REVIEW_OSS_BUCKET` | 人工精修 PDF 私有 OSS 开关、HTTPS 地域 endpoint 与私有 Bucket；普通 PDF 导出不使用 OSS |
| `RESUME_REVIEW_OSS_ACCESS_KEY_ID` / `RESUME_REVIEW_OSS_ACCESS_KEY_SECRET` | 应用 RAM 凭据，用于签发短期上传策略以及校验、复制、读取专用前缀对象；二者不得预置进前端变量或日志，Secret 永不返回浏览器，ID 仅作为短期 POST 表单的非秘密字段按需返回 |
| `RESUME_REVIEW_OSS_STAGING_PREFIX` / `RESUME_REVIEW_OSS_OBJECT_PREFIX` | 待核验上传与已冻结对象的两个独立、互不包含的相对前缀；仅允许字母、数字、`/`、`_`、`-`，必须以 `/` 结尾且不能含 `//` |
| `RESUME_REVIEW_OSS_UPLOAD_URL_TTL_MINUTES` / `RESUME_REVIEW_OSS_READY_TTL_MINUTES` / `RESUME_REVIEW_OSS_MAX_PDF_BYTES` / `RESUME_REVIEW_OSS_RETENTION_DAYS` | 短期上传策略、已核验票据、单文件大小和冻结对象保留期；默认分别为 10 分钟、30 分钟、10 MiB、30 天 |
| `RESUME_REVIEW_OSS_MAX_CONCURRENT_FINALIZATIONS` | OSS 完成冻结的全局并发上限，默认 `4`，生产允许 `1` 至 `16`；超出后立即返回 503，不排队占用数据库连接 |
| `RESUME_REVIEW_OSS_*_CONFIRMED` | 仅供生产预检的四个确认位；私有桶、精确 CORS、生命周期和 RAM 最小权限完成真实核验并留证后才可设为 `true` |
| `RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS` / `RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED` | 第二次及以后人工精修的新付费单开关与生产验收确认位；价格由管理后台配置，默认 0 时后端拒绝下单 |

说明：

- 所有 AI 请求只通过后端接口发起，并在后端实时校验 VIP；不要把 AI API Key 配置为 `VITE_*` 前端变量，避免密钥进入浏览器构建产物。
- 前端和后端现在统一从项目根目录 `.env` 读取配置，不再维护 `server/.env`。

### 字段优化提示词

- 字段优化页面使用的默认 `系统提示词`、`项目简介/项目描述`、`核心职责` 提示词，统一维护在 [config/field-optimize-prompts.yml](/Users/itwanger/Documents/GitHub/PaiResume/config/field-optimize-prompts.yml)。
- 这份 YAML 是多行可编辑配置，适合直接调整提示词，不需要把长文本塞进 `.env` 单行。
- 如果需要换路径，可以在根目录 `.env` 里修改 `FIELD_OPTIMIZE_PROMPTS_FILE`。
- 后端会按请求读取这份 YAML，并把同一份配置返回给前端字段优化页，所以前后端默认提示词是一致的。
- 修改 YAML 后：
- 后端下一次字段优化请求会使用新提示词。
- 前端字段优化页需要重新进入一次，才能看到新的默认提示词。

## 当前功能说明

### 认证

- 默认使用派聪明服务号临时参数二维码扫码注册/登录；AppSecret 和 access_token 只由 paicoding 持有，PaiResume 通过双向 HMAC 网关生成二维码并接收可信事件
- 纯扫码账号不伪造邮箱或密码；二维码生成前须主动确认当前服务条款、隐私政策和 AI 第三方处理说明，扫码兑换时在登录事务内记录当前协议版本，不再二次跳转
- 邮箱注册/登录保留为兼容入口，邮箱注册需要验证码
- 注册时必须确认当前版本的服务条款、隐私政策和 AI 第三方处理说明；旧账号需补签后才能继续调用受保护接口
- 支持邮箱验证码找回密码，重置后立即撤销旧刷新会话和旧访问令牌
- 邮箱账号用当前密码二次确认注销；纯扫码账号必须重新扫描派聪明并使用 5 分钟内的一次性凭证。未完成订单、人工精修、待退款或作者余额未结清时会阻止注销
- 未登录的知识星球成员统一从 `/vip/claim` 输入邀请码：这一步只创建短期领取凭证，不生成匿名账号、不占用名额；随后先确认当前协议，再通过派聪明扫码注册/登录并原子核销邀请码、开通 VIP
- 已有邮箱账号必须先使用邮箱登录，再回到 `/vip/claim` 输入邀请码直接领取；未绑定过派聪明时直接扫码会创建独立微信账号，系统不会自动合并两个账号
- `accessToken` 只保存在页面内存；生产环境的 `refreshToken` 只存在于 `HttpOnly + Secure + SameSite=Strict` Cookie，本地 HTTP 开发才允许关闭 `Secure`
- 遇到明确的 401 时，前端会串行轮换刷新 Token；普通 403 不触发刷新

默认账号（开发环境自动创建）：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 普通用户 | `test@example.com` | `Test123456` |
| 管理员 | `admin@example.com` | `Admin123456` |

注意：

- 验证码通过后端 SMTP 投递为 UTF-8 HTML 邮件，并附带纯文本降级内容；邮件中的有效期直接读取 `VERIFICATION_CODE_TTL_SECONDS`，默认 5 分钟。
- 验证码邮件会展示 `APP_PUBLIC_URL`，默认是 [https://resume.paicoding.com](https://resume.paicoding.com)；未配置 SMTP、认证失败或投递失败都会返回错误，不会降级为日志明文验证码。
- 生产环境必须显式设置 `APP_ENV=production`、独立的 `JWT_SECRET` 与 `VERIFICATION_CODE_SECRET`、安全 Cookie、HTTPS CORS、数据库 TLS、Redis 密码和有效 SMTP 授权码，否则服务拒绝启动。
- paicoding 侧必须用同一独立共享密钥开启 `PAIRESUME_WECHAT_BRIDGE_ENABLED`，把回调指向 `/api/public/wechat/bridge/events`；两个系统都默认关闭，未完成真实派聪明回调验收前不得宣称扫码登录已上线。

### 人工简历精修

- 普通“导出 PDF”完全由浏览器使用当前预览数据生成并下载，不经过后端、OSS 或邮件链路，生产环境不需要 Node/PDF worker。
- 申请人工精修时，用户必须自行选择最终确认的 PDF。浏览器先计算 SHA-256，再取得只允许当前随机 staging 对象、PDF 类型和限定大小的短期上传策略，直接把文件提交到私有 OSS；浏览器只会收到 POST 表单所需的非秘密 AccessKey ID，永远拿不到 AccessKey Secret，也不能指定对象键、外部 URL、本地路径或收件人。
- 上传完成后，服务端先从 OSS 流式读取 staging 一次，校验大小、类型、完整 SHA-256 与 `%PDF-`，再按源 ETag 在 OSS 内复制到随机冻结对象；全局最多同时执行 `RESUME_REVIEW_OSS_MAX_CONCURRENT_FINALIZATIONS` 路，超出立即返回 503，不排队占用数据库连接。申请只绑定服务端记录的冻结对象键、ETag、文件名、大小和 SHA-256，后续编辑不会覆盖本次文件。staging 不在业务事务中立即删除，以便 OSS 复制成功但数据库事务失败时安全重试，最迟由独立短生命周期规则清理。
- 邮件 outbox 保持单 worker 顺序处理。每次投递前，服务端从私有 OSS 把不超过配置上限的冻结对象临时读取一次到 JVM 内存并再次校验完整 SHA-256，只发送到配置好的固定私密收件箱，不写服务器本地 PDF。SMTP 接受后副本无法远程召回。
- 用户需要单独验证联系邮箱，并分别确认人工处理授权、OSS 直传与固定邮箱发送授权。
- 第一份人工精修免费；第一份邮件被 SMTP 接受时才核销机会，发送失败不扣次数。
- 第二份及以后每份独立下单。服务端只读取管理后台保存的价格；默认价格为 0、独立新单开关默认关闭，任一条件不满足都拒绝创建付费单。
- 邮件自动投递遇到确定性附件校验失败时立即停止，其他 OSS/SMTP 故障达到 `RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS` 后停止，避免永久故障无限重试；管理员仍可在核明原因后手动重试或退回。
- 后台可处理邮件重试、接受、完成、退回、退款确认和审计记录。已发送的免费单即使退回也不恢复次数；付费退回必须先进入退款复核。

### 权限规则

| 能力 | 免费用户 | 有效 VIP |
| --- | --- | --- |
| 编辑简历 | 支持 | 支持 |
| 保存简历 | 支持 | 支持 |
| 导入 Markdown / TXT | 支持 | 支持 |
| AI 模块/字段优化 | 不支持 | 支持 |
| AI 整份简历分析 | 不支持 | 支持 |
| AI 智能一页 | 不支持 | 支持 |
| PDF 导出 | 不支持 | 支持 |
| 查看公开优质简历 | 支持 | 支持 |
| 查看 VIP 权益优质简历 | 不支持 | 支持 |

AI 与需要 VIP 权益解锁的优质简历权限由服务端实时校验。PDF 文件本身在浏览器生成，不存在可绕过的服务端渲染接口；前端仍须基于服务端返回的当前会员状态决定是否展示导出能力。

### 简历编辑

- 在工作台创建简历后进入编辑页
- 左侧为模块导航，中间为模块表单，右侧为实时预览
- 支持同类模块多实例的有：实习经历、项目经历、论文发表、科研经历、获奖情况等
- 有效 VIP 支持对单个模块、字段发起 AI 优化
- 有效 VIP 支持对整份简历执行 AI 分析和智能一页生成

### 导入与导出

- 当前已启用：Markdown / TXT 导入
- 当前未启用：Word 导入、PDF 导入
- 有效 VIP 已支持浏览器本地生成并下载 PDF，导出文件名会尽量根据姓名、学校、求职意向生成；普通导出不会上传到 OSS

### 优质简历与会员

- `/excellent-resumes` 展示管理员发布的优质简历标题、摘要和标签，不返回完整简历模块
- 管理员可逐条设置“公开查看”或“付费查看（VIP 权益）”；列表不提前显示访问属性，用户点击后由详情接口判定
- 公开简历允许游客和登录用户直接查看；需要 VIP 权益的简历会引导游客先登录、普通用户进入会员开通与报价页
- VIP 可解锁全部优质简历详情和 PDF 导出
- 知识星球 VIP 邀请码与支付优惠码是两套独立能力：邀请码直接兑换该批次配置的 VIP 天数，优惠码仅在年费会员报价/支付时抵扣金额
- 邀请码每个批次默认赠送 `30` 天，管理员创建时可选择 `30`、`90` 或 `365` 天；兑换成功后从实际兑换时间起获得完整批次权益，批次截止时间只限制领取时间
- 未登录领取时，邀请码只换取默认 10 分钟的高熵领取凭证，凭证和扫码 challenge 在服务端只保存摘要；邀请码、领取令牌都不进入 URL 或二维码。二维码过期可在领取凭证有效期内更新，只有最新二维码能绑定领取
- 创建领取凭证不会预占批次名额；最终领取时重新锁定并校验账号、批次状态、截止时间和剩余名额，成功后一次性写入兑换记录、会员权益和领取状态。成功请求可安全重试，返回同一条兑换结果
- 管理员可按星球批次生成邀请码，配置权益天数、兑换截止时间和人数上限，查看每位兑换用户及到期时间，也可随时作废未用完的码
- 作废批次只阻止后续新兑换，不批量撤销已经领取的权益；确认泄露时由管理员按兑换记录逐条撤销异常权益并填写原因
- 每个账号终身只能领取一次邀请码福利；撤销后也不能换码再次领取，邀请码不能与已有有效会员叠加，也不会覆盖或缩短已有权益
- 邀请码兑换按账号和 IP 限流，避免撞库枚举；生成、作废、异常撤销、人工开通、延期和撤销会员均写入审计日志
- 管理员可以按用户延期有限期会员；延期保留原始权益来源，永久会员不需要也不能延期
- VIP 到期不会自动续期，用户的简历数据继续保留；如需继续使用会员功能，由管理员延期或用户购买默认 `365` 天的年费会员
- 后台提供一键复制星球发布文案，文案包含网站注册链接、邀请码、权益期限、截止时间、剩余名额及防泄露提示
- 批次邀请码属于可转发的福利凭证，泄露后无法判断领取者是否来自知识星球；运营上应控制发放范围，发现泄露立即作废批次并逐条复核异常领取
- 会员微信 Native 在线支付代码路径已实现但默认关闭：每笔年费会员默认 `365` 天，创建订单时固化原价、优惠、实付和权益天数，支付成功后有限期会员从 `max(当前时间, 原到期时间)` 续期，永久会员不能购买。应付为 0 的有效优惠码订单在本地原子开通，不向微信创建 0 元订单
- 会员订单固定保留 30 分钟。到期任务必须先主动查单；仍未支付才请求微信关单，并在二次查单确认关闭后标记 `CANCELED`、释放活动订单。已收款回调即使晚于本地取消也不会被静默丢弃：没有更晚成交单时正常开通，有更晚 `PAID` 替代单时进入 `REFUND_REQUIRED` 人工退款
- 会员支付与用户简历市场分别由 `MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS`、`MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS` 控制；旧总开关不能再开启。未成功发放该笔权益的会员异常订单使用 `PENDING -> REFUND_PROCESSING -> REFUNDED` 人工退款状态机，也可填写原因后驳回或关闭；每次有效操作都记录管理员、原因和审计时间，退款完成时必须记录退款流水。接口只登记商户平台退款结果，不发起真实退款；本单已发放权益时会拒绝退款登记，必须先按权益来源重算，避免误撤其他续费、邀请或管理员权益
- 支付优惠码绑定问卷提交邮箱，报价和下单都要求登录且匹配当前账号；真正结算时再次在同一事务中锁定优惠码，只有 `ISSUED` 且未过期才更新为 `USED`
- 会员与简历市场共用一个微信回调地址；回调由 SDK 单次验签、解密后，再按已验证订单号的 `PM`（会员）/`PR`（简历市场）前缀安全分流

### 用户简历市场与作者收益

- 用户简历市场代码路径已实现但默认关闭；首阶段仅展示平台官方精选，完成内容治理和真实小额商户验收后才按运行手册开放
- 作者可将自己的简历发布为免费公开或一次性付费解锁；同一账号对同一已购版本刷新、重复打开不会再次扣费。付费价格和内容都在下单时保存不可变快照，后续修改不会悄悄改变已购买版本
- `PAYMENT_PROVIDER=disabled` 是默认值，且不能同时开启新订单；`mock` 仅允许开发/测试，`wechat-native` 使用微信支付 Native 下单、API v3 回调验签和主动查单。市场支付只有显式开启 `MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS` 才展示支付入口并创建订单；生产维护时只关闭业务开关，保留微信网关处理回调和历史订单
- 本地订单会先提交，再向微信发起预下单；回调和主动查单共用同一个幂等落账入口，原子生成永久查看权益、作者收益和钱包余额
- 新收益先进入 `HOLDING` 冻结余额，默认 7 天后才转为 `AVAILABLE`；冻结期内按可配置的稀疏间隔查单，到期后必须再取得一次晚于冻结截止点的主动查单 `PAID` 验真结果才会放款，延迟或重放的原支付回调不能充当最终验真。网络或支付平台异常只会延后放款，不会绕过最终验真
- 下架、转免费、替换版本或平台暂停时，会给既有活动订单写入销售截止点，并由持久化补偿任务分批查询/关闭支付平台订单；本地时间或网络异常不会直接释放活动订单占位
- 正常在售但丢失回调的订单也会由跨节点数据库租约任务持续主动查单：未过期 `PENDING` 只查询不关闭，过期或预下单结果不确定的订单先查单、再关闭并复查；二维码在本地过期后立即停止返回
- 重复付款、已撤销权益或销售失效后的付款会进入 `DUPLICATE_PAID` / `REFUND_REQUIRED` 人工复核队列，不会重复给作者记收益。当前退款必须由管理员在线下/微信商户平台人工处理
- 作者收益状态为 `HOLDING -> AVAILABLE -> PENDING_SETTLEMENT -> SETTLED`，退款后进入 `REVERSED`。作者发起结算申请后，管理员完成线下转账并填写流水/备注；当前没有接入微信自动分账或自动提现
- “待抵扣欠款”只会在已经线下打款的收益后来发生退款，或可用/待结算聚合余额不足以完成反冲时产生；系统不会把钱包余额扣成负数，而会用后续新收益优先抵扣该欠款。`lifetimeEarnedCents` 保留历史收入，`lifetimeRefundedCents` 记录累计冲销，二者之差是累计净收入
- 管理员手工确认退款前，必须先在微信商户平台完成并核实**全额退款**；PaiResume 的确认接口本身不向微信发起退款。普通 `PAID` 订单和异常退款队列订单都通过同一事务反冲，支付平台主动查到的全额退款不需要人工退款流水
- 微信交易查询中的 `REFUND（转入退款）` 只表示进入退款流程，不能单独证明退款成功或金额等于整单；系统会把订单置于人工复核门槛，但不提前撤销 100% 权益/账务。管理员核实全额退款后再确认反冲；部分退款需先在商户平台补足或处理完毕

## 主要接口

### 认证接口

- `POST /api/auth/register`：邮箱兼容注册；`inviteCode` 仅保留旧客户端兼容，新流程使用 `/vip/claim`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/send-code`
- `POST /api/auth/password-reset/code`：请求找回密码验证码；无论邮箱是否存在都返回相同结果
- `POST /api/auth/password-reset/confirm`：校验验证码并重置密码、撤销旧会话
- `POST /api/auth/legal-consent`：确认当前协议版本
- `DELETE /api/auth/account`：请求体同时校验当前密码和固定确认语“注销账号”后注销
- `POST /api/auth/wechat/challenges` / `GET .../{challengeId}` / `POST .../{challengeId}/exchange`：派聪明扫码登录挑战、轮询与一次性换票；创建挑战时可传短期 `claimToken`，兑换时可提交 `termsAccepted` 与 `privacyAccepted`，但二维码中不包含邀请码或领取令牌
- `POST /api/auth/wechat/reauth-challenges`：纯扫码账号注销前的短期身份复核

### 人工精修接口

- `GET /api/resume-reviews/eligibility` / `GET /api/resume-reviews/current`：查询下一次权益和恢复当前活动申请
- `POST /api/resume-reviews/uploads`：为当前账号、当前简历和声明的 PDF 元数据创建短期、单对象 OSS 直传凭证
- `POST /api/resume-reviews/uploads/{uploadNo}/complete`：由服务端核验 staging 对象并在 OSS 内冻结，成功后返回 `READY`
- `POST /api/resume-reviews/contact-email/code` / `POST /api/resume-reviews`：验证联系邮箱，并使用同账号、同简历且未过期的 `uploadNo` 创建人工精修申请
- `POST /api/resume-reviews/{requestNo}/payment/refresh`：第二次及以后付费单主动查单
- `GET /api/admin/resume-reviews` 及其 `accept`、`complete`、`return`、`mail/retry`、`refund/confirm` 子接口：后台人工处理与退款留痕

### 简历接口

- `GET /api/resumes`
- `POST /api/resumes`
- `PUT /api/resumes/{id}`
- `DELETE /api/resumes/{id}`
- `GET /api/resumes/{id}/modules`
- `POST /api/resumes/{id}/modules`
- `POST /api/resumes/{id}/modules/{mid}/update`
- `DELETE /api/resumes/{id}/modules/{mid}`

### 优质简历与会员接口

- `GET /api/public/showcases`：公开卡片列表，不含完整模块
- `GET /api/public/showcases/{slug}`：公开简历详情；访问属性不是 `FREE` 时拒绝返回完整模块
- `GET /api/showcases/{slug}`：登录用户查看简历详情；`FREE` 直接返回，`VIP` 通过服务端会员校验后返回
- `POST /api/public/vip-invite-claims`：未登录用户验证邀请码并创建不预占名额的短期领取凭证；无效、过期、作废和名额耗尽统一返回不可领取
- `POST /api/membership/vip-invite-claims/complete`：扫码绑定账号并确认当前协议后，原子完成邀请码核销与 VIP 开通；同一成功请求可幂等重试
- `POST /api/membership/redeem-invite`：已注册用户兑换知识星球 VIP 邀请码
- `POST /api/membership/quote`：会员价格与优惠码报价
- `POST /api/membership/orders`：按幂等键创建或复用会员 Native 支付订单；应付 0 元时直接原子结算
- `GET /api/membership/orders/{orderNo}`：用户查看自己的会员订单金额快照、二维码、30 分钟截止时间及权益天数
- `POST /api/membership/orders/{orderNo}/refresh`：主动查单；到期仍未支付时执行查单、关单、复查
- `GET /api/admin/membership/payment-orders`：管理员分页查询会员订单，可按支付状态、复核状态筛选
- `GET /api/admin/membership/payment-orders/{orderNo}`：查看会员订单详情和不可覆盖的人工处置审计记录
- `GET /api/admin/membership/payment-orders/summary`：查看待退款、重复付款和本进程对账失败汇总
- `POST /api/admin/membership/payment-orders/{orderNo}/refund-processing`：记录已开始线下/商户平台退款，本接口不发起真实退款
- `POST /api/admin/membership/payment-orders/{orderNo}/confirm-refunded`：填写退款流水并确认退款完成；也可通过 `/reject`、`/close` 填写原因后终结复核

### 用户简历市场与支付接口

- `GET /api/public/marketplace/listings`：分页查看公开简历市场
- `GET /api/public/marketplace/listings/{slug}`：查看公开报价与摘要
- `GET /api/public/marketplace/listings/{slug}/content`：读取已审核的免费公开正文
- `POST /api/public/marketplace/listings/{slug}/reports`：提交举报或侵权投诉，来源 IP 只保存不可逆摘要并受频率限制
- `PUT /api/creator/resumes/{resumeId}/listing`：作者发布/更新免费或付费版本
- `POST /api/creator/resumes/{resumeId}/listing/unpublish`：作者下架公开简历
- `GET /api/creator/marketplace/appeals` / `POST /api/creator/listings/{listingId}/appeals`：查看并提交创作者申诉
- `POST /api/marketplace/listings/{slug}/orders`：在 `MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS=true` 时按幂等键创建 Native 支付订单
- `GET /api/marketplace/orders/{orderNo}`：买家查看自己的订单状态和支付二维码
- `POST /api/marketplace/orders/{orderNo}/refresh`：受服务端限频保护的主动查单
- `POST /api/public/payments/wechat/notify`：微信支付 API v3 匿名回调（验签失败返回非 2xx）
- `GET /api/creator/earnings/summary` / `GET /api/creator/earnings`：作者收益汇总与最近 200 条明细
- `POST /api/creator/earnings/{id}/request-settlement`：作者申请线下结算
- `GET /api/admin/creator-earnings?status=PENDING_SETTLEMENT`：管理员查看待结算收益
- `POST /api/admin/creator-earnings/{id}/settle`：管理员确认线下转账
- `GET /api/admin/marketplace/payment-reviews`：管理员查看重复付款/待人工退款订单
- `GET /api/admin/marketplace/payment-reviews/close-work`：管理员查看仍待支付平台关闭确认的订单
- `GET /api/admin/marketplace/payment-reviews/{orderNo}`：按订单号查询任意支付订单，便于定位普通已支付订单
- `POST /api/admin/marketplace/payment-reviews/{orderNo}/confirm-refunded`：确认已在微信商户平台完成的全额退款，并原子撤销权益、订单和作者账本；该接口本身不发起退款
- `GET /api/admin/marketplace/listings` / `PATCH /api/admin/marketplace/listings/{listingId}/moderation`：管理员审核投稿、平台下架或恢复
- `GET /api/admin/marketplace/reports` / `PATCH /api/admin/marketplace/reports/{reportId}`：管理员查询并处理举报
- `GET /api/admin/marketplace/appeals` / `PATCH /api/admin/marketplace/appeals/{appealId}`：管理员查询并处理创作者申诉
- `GET /api/admin/marketplace/audits`：按条目追踪市场治理审计记录

### 管理员 VIP 邀请码接口

- `POST /api/admin/vip-invites`：生成可多人兑换的 VIP 批次码；`membershipDays` 只能是 `30`、`90` 或 `365`，未填默认 `30` 天
- `GET /api/admin/vip-invites`：查看邀请码批次、进度和状态
- `GET /api/admin/vip-invites/{id}/redemptions`：查看该批次的兑换用户和会员到期时间
- `POST /api/admin/vip-invites/{id}/invalidate`：立即作废邀请码
- `POST /api/admin/vip-invites/{inviteId}/redemptions/{redemptionId}/revoke`：逐条撤销异常领取的邀请权益
- `GET /api/admin/membership-audit-logs`：查看最近 200 条会员与邀请码后台操作日志
- `POST /api/admin/users/{id}/membership/grant`：手工开通永久会员
- `POST /api/admin/users/{id}/membership/extend`：按天延长指定用户的有限期会员
- `POST /api/admin/users/{id}/membership/revoke`：手工撤销会员

作废邀请码、逐条撤销异常领取、人工开通、延期和撤销会员的请求都必须提交非空的 `reason`。邀请码作废接口不会修改既有兑换记录；异常领取只能通过指定 `redemptionId` 单独处理。

### AI 接口

- `POST /api/resumes/{resumeId}/modules/{moduleId}/ai-optimize`
- `POST /api/resumes/{resumeId}/modules/{moduleId}/ai-optimize-field`
- `POST /api/resumes/{resumeId}/analysis`
- `POST /api/resumes/{resumeId}/smart-onepage/preview`

以上 AI 接口（包括流式接口、最近结果和提示词配置）均要求有效 VIP；免费用户返回 HTTP `403` 和业务码 `4006`。

## 开发建议

- 建议先启动 MySQL 和 Redis，再启动后端，最后启动前端
- 如果前端请求异常，先确认 `VITE_API_PROXY_TARGET` 与后端端口是否一致
- 如果注册拿不到验证码，检查垃圾邮件目录、SMTP 授权码和后端的脱敏投递错误；验证码本身不会写入日志
- 如果 AI 分析失败，优先检查后端 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`
- 如果 PDF 导出异常，确认 `public/fonts/` 下的字体文件存在

## 上线材料

- [deploy/README.md](deploy/README.md)：三阶段开关、发布顺序、运行时资产、回滚与外部人工验收
- `scripts/production-preflight.sh`：校验密钥、数据库 TLS、SMTP、OSS 参数与四项配置确认位、法律披露、最小发布资产，并按 `free`、`membership`、`marketplace` 三阶段强制核对支付、市场及人工验收开关
- `scripts/backup-mysql.sh` / `scripts/restore-mysql.sh`：带 SHA-256 完整性校验的备份与显式确认恢复
- `scripts/switch-release.sh` / `scripts/smoke-production.sh`：版本切换与上线后冒烟检查
- `.github/workflows/ci.yml`：前端 lint/构建和后端完整测试

## 后续可扩展方向

- 后续可切换到自有域名发信服务，并配置 SPF、DKIM 与 DMARC
- 开放 Word / PDF 简历导入
- 增加更多模板与排版主题
- 增加简历分享、公开链接和多模板导出
- 增加容器化、制品签名与自动化 CD（当前生产发布仍要求人工确认）
