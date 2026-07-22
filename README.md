# PaiResume

PaiResume 是一个面向中文简历场景的在线简历编辑器，采用前后端分离架构，支持账号体系、模块化简历编辑、实时预览、Markdown/TXT 简历导入、AI 优化与整份简历分析，以及 PDF 导出。

## 项目特性

- 邮箱注册、登录、Token 刷新与退出登录
- 简历列表管理：新建、重命名、删除
- 模块化简历编辑：基础信息、教育背景、实习经历、项目经历、专业技能、论文发表、科研经历、获奖情况
- 实时预览，编辑区与预览区联动
- 支持拖拽导入 Markdown / TXT 格式的结构化简历
- VIP 支持 AI 单模块优化
- VIP 支持整份简历分析与评分，支持自定义分析提示词
- 优质简历菜单：公开摘要、VIP 查看完整内容，详情权限由服务端校验
- 用户简历市场：作者可免费公开或按次定价；付费成功后永久解锁购买时的不可变版本，并进入作者收益账本
- 知识星球 VIP 邀请码：支持批次生成、限额、截止时间、兑换记录、风控、审计、异常权益撤销和会员延期
- 内置“校园技术蓝”等多套推荐排版
- VIP 支持导出 PDF
- 提供健康检查与就绪检查接口

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

- 后端使用 Flyway 记录并执行版本化数据库迁移；全新空库和首次接入旧数据库都会从 V5 建立基线，再执行 `V6__ReconcilePaiResumeSchema` 创建或对齐基础结构，随后依次执行 V7 邀请码、V8 会员来源追踪/审计/异常撤销、V9 简历市场、V10 支付生命周期加固、V11 作者收益冻结/退款账务和 V12 支付对账租约迁移。
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
| `APP_ENV` | 运行环境，默认 `development` |
| `APP_TIME_ZONE` | 固定为 `Asia/Shanghai`；JVM、Jackson 与 MySQL 会话统一使用该业务时区，其他值会拒绝启动 |
| `APP_PUBLIC_URL` | 项目公网地址，默认 `https://resume.paicoding.com`；用于验证码邮件中的安全链接 |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | 允许跨域来源 |
| `SERVER_PORT` | 后端端口，默认 `8084` |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USERNAME` / `MYSQL_PASSWORD` | MySQL 连接配置 |
| `FLYWAY_ENABLED` / `FLYWAY_USERNAME` / `FLYWAY_PASSWORD` | Flyway 开关与独立迁移账号；生产迁移账号负责 DDL，业务账号使用最小权限 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接配置 |
| `VIP_INVITE_RATE_LIMIT_WINDOW_SECONDS` / `VIP_INVITE_RATE_LIMIT_ACCOUNT_ATTEMPTS` / `VIP_INVITE_RATE_LIMIT_IP_ATTEMPTS` | 邀请码兑换窗口及账号/IP 尝试次数限制 |
| `JWT_SECRET` | JWT 密钥，生产环境必须替换 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_ANALYSIS_MODEL` | AI 服务配置 |
| `FIELD_OPTIMIZE_PROMPTS_FILE` | 字段优化默认提示词配置文件路径，默认 `config/field-optimize-prompts.yml` |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` | SMTP 认证账号、客户端授权码和发件地址 |
| `PAYMENT_PROVIDER` | 简历市场支付提供方，默认 `disabled`；本地/测试可用 `mock`，生产禁止使用 mock |
| `PAYMENT_ACCEPT_NEW_ORDERS` | 是否接受新的市场订单，默认 `false`；维护时保留 `wechat-native` 并设为 `false`，回调和历史订单对账仍继续工作 |
| `PAYMENT_ORDER_EXPIRE_MINUTES` / `MARKETPLACE_PLATFORM_FEE_BPS` | 市场订单有效期与平台费率（基点）；平台费默认 `0` |
| `MARKETPLACE_EARNING_HOLD_DAYS` | 作者收益退款观察期，默认 `7` 天；生产必须至少为 `1`，仅开发/E2E 可设为 `0` |
| `MARKETPLACE_PAID_RECONCILIATION_INTERVAL_MINUTES` / `MARKETPLACE_PAID_DUE_RECONCILIATION_RETRY_MINUTES` | 冻结期内已支付订单的稀疏查单间隔（默认 360 分钟）与到期最终验真失败后的重试间隔（默认 5 分钟） |
| `WECHAT_PAY_APP_ID` / `WECHAT_PAY_MERCHANT_ID` | 微信支付 AppID 与商户号 |
| `WECHAT_PAY_PRIVATE_KEY` / `WECHAT_PAY_MERCHANT_SERIAL_NUMBER` / `WECHAT_PAY_API_V3_KEY` | 微信支付 API v3 商户密钥、证书序列号与 API v3 Key；只配置在后端 |
| `WECHAT_PAY_NOTIFY_URL` | 微信支付回调公网 HTTPS 地址，必须精确指向 `/api/public/payments/wechat/notify` |

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

- 注册时需要邮箱验证码
- 注册时可选填知识星球 VIP 邀请码；兑换成功后注册首屏立即显示 VIP 状态
- `accessToken` 只保存在页面内存，`refreshToken` 只存在于 `HttpOnly + Secure + SameSite=Strict` Cookie
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
| 查看完整优质简历 | 不支持 | 支持 |

AI、PDF 导出和完整优质简历权限必须由服务端实时校验，不能只依赖前端隐藏按钮。会员到期或管理员撤销权益后，下一次请求立即失去对应权限，无需等待重新登录。

### 简历编辑

- 在工作台创建简历后进入编辑页
- 左侧为模块导航，中间为模块表单，右侧为实时预览
- 支持同类模块多实例的有：实习经历、项目经历、论文发表、科研经历、获奖情况等
- 有效 VIP 支持对单个模块、字段发起 AI 优化
- 有效 VIP 支持对整份简历执行 AI 分析和智能一页生成

### 导入与导出

- 当前已启用：Markdown / TXT 导入
- 当前未启用：Word 导入、PDF 导入
- 有效 VIP 已支持 PDF 导出，导出文件名会尽量根据姓名、学校、求职意向生成

### 优质简历与会员

- `/excellent-resumes` 展示管理员发布的优质简历标题、摘要和标签，不返回完整简历模块
- 完整详情仅对有效 VIP 开放；未登录用户先登录，免费用户进入 VIP 开通与报价页
- VIP 同时解锁优质简历详情和 PDF 导出
- 知识星球 VIP 邀请码与支付优惠码是两套独立能力：邀请码直接兑换 30 天 VIP，优惠码仅在会员报价/支付时抵扣金额
- 邀请码兑换成功后，从实际兑换时间起获得完整 30 天 VIP；批次截止时间只限制领取时间，不缩短已领取权益
- 管理员可按星球批次生成邀请码，配置兑换截止时间和人数上限，查看每位兑换用户及到期时间，也可随时作废未用完的码
- 作废批次只阻止后续新兑换，不批量撤销已经领取的权益；确认泄露时由管理员按兑换记录逐条撤销异常权益并填写原因
- 每个账号终身只能领取一次邀请码福利；撤销后也不能换码再次领取，邀请码不能与已有有效会员叠加，也不会覆盖或缩短已有权益
- 邀请码兑换按账号和 IP 限流，避免撞库枚举；生成、作废、异常撤销、人工开通、延期和撤销会员均写入审计日志
- 管理员可以按用户延期有限期会员；延期保留原始权益来源，永久会员不需要也不能延期
- VIP 到期不会自动续期，用户的简历数据继续保留；如需继续使用会员功能，由管理员延期或用户后续购买会员
- 后台提供一键复制星球发布文案，文案包含网站注册链接、邀请码、权益期限、截止时间、剩余名额及防泄露提示
- 会员购买当前只提供报价、支付优惠码和后台人工开通能力，会员在线支付订单与支付回调尚未接入；这与下述“用户简历市场”的按次 Native 支付是两套独立业务

### 用户简历市场与作者收益

- 作者可将自己的简历发布为免费公开或一次性付费解锁；同一账号对同一已购版本刷新、重复打开不会再次扣费。付费价格和内容都在下单时保存不可变快照，后续修改不会悄悄改变已购买版本
- `PAYMENT_PROVIDER=disabled` 是默认值，且不能同时开启新订单；`mock` 仅允许开发/测试，`wechat-native` 使用微信支付 Native 下单、API v3 回调验签和主动查单。`PAYMENT_ACCEPT_NEW_ORDERS` 默认 `false`，只有显式开启才会展示支付入口并创建订单；生产维护时只关闭该开关，保留微信网关处理回调和历史订单
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

- `POST /api/auth/register`：`inviteCode` 为可选字段；填写有效邀请码时同步开通 30 天 VIP
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/send-code`

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
- `GET /api/showcases/{slug}`：VIP 简历详情，需要登录并通过服务端会员校验
- `POST /api/membership/redeem-invite`：已注册用户兑换知识星球 VIP 邀请码
- `POST /api/membership/quote`：会员价格与优惠码报价

### 用户简历市场与支付接口

- `GET /api/public/marketplace/listings`：分页查看公开简历市场
- `GET /api/public/marketplace/listings/{slug}`：查看公开报价；免费简历可直接读取公开内容
- `PUT /api/creator/resumes/{resumeId}/listing`：作者发布/更新免费或付费版本
- `POST /api/creator/resumes/{resumeId}/listing/unpublish`：作者下架公开简历
- `POST /api/marketplace/listings/{slug}/orders`：在 `PAYMENT_ACCEPT_NEW_ORDERS=true` 时按幂等键创建 Native 支付订单
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

### 管理员 VIP 邀请码接口

- `POST /api/admin/vip-invites`：生成一个可多人兑换的 30 天 VIP 批次码
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

## 后续可扩展方向

- 后续可切换到自有域名发信服务，并配置 SPF、DKIM 与 DMARC
- 开放 Word / PDF 简历导入
- 增加更多模板与排版主题
- 增加简历分享、公开链接和多模板导出
- 增加部署脚本、Docker 化与 CI/CD
