# 派简历上线运行手册

本目录只提供可审查、可演练的生产部署材料，不会自动连接或修改生产环境。首次上线必须从已确认的提交或标签构建，不能直接发布本地脏工作区。

## 三阶段开关

1. 免费或邀请灰度：`DEPLOY_STAGE=free`、`PAYMENT_PROVIDER=disabled`，`MARKETPLACE_ENABLED`、会员/市场新订单开关和 `RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS` 均为 `false`；派聪明扫码登录、人工精修固定收件箱及独立“沉默王二”关注桥仍须真实验收。
2. 会员支付：先在隔离的预发布域名和测试账号中使用 `DEPLOY_STAGE=membership-acceptance`、`PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED=true`、`PAYMENT_PROVIDER=wechat-native` 与真实小额商户参数执行 `checklists/wechat-payment-acceptance.md`。人工精修付费还需单独执行 `checklists/resume-review-acceptance.md`。验收留证后才切为 `DEPLOY_STAGE=membership`、`MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED=true`；只有人工精修清单也完成时，才可设置 `RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED=true` 并按需打开其独立新单开关。用户市场仍关闭。
3. 用户付费简历市场：再用 `DEPLOY_STAGE=marketplace-acceptance` 在隔离环境完成 `checklists/marketplace-payment-acceptance.md`。正式获批后使用 `DEPLOY_STAGE=marketplace`、两个支付验收确认位与 `MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED=true`；市场功能和两个新订单开关均允许在维护时关闭，`PAYMENT_PROVIDER` 必须继续保留 `wechat-native` 处理历史回调与对账。

旧变量 `PAYMENT_ACCEPT_NEW_ORDERS` 必须始终为 `false`，不能用它同时打开两类订单。

人工精修的真实单价保存在后台平台配置中，数据库默认值为 `0`。发布脚本不会猜测价格；价格未配置、支付 Provider 不是真实微信或独立开关未开时，第三次及以后请求必须保持拒绝下单。

## 两个公众号边界

- 登录/注册只使用“派聪明”服务号。PaiResume 只保存 AppID 和独立 HMAC 密钥，不保存服务号 AppSecret/access_token。
- paicoding 进程需要同步配置 `PAIRESUME_WECHAT_BRIDGE_ENABLED=true`、`PAIRESUME_WECHAT_BRIDGE_CALLBACK_URL=https://resume.paicoding.com/api/public/wechat/bridge/events`、`PAIRESUME_WECHAT_BRIDGE_SECRET` 和相同 `PAIRESUME_WECHAT_SCENE_PREFIX`；共享密钥必须与 PaiResume 的 `PAICONGMING_WECHAT_BRIDGE_SECRET` 完全一致，且不能与其他应用密钥复用。
- 第二次人工精修的免费机会只由独立“沉默王二”公众号关注桥签发，不能读取或复用派聪明的关注状态。生产预检要求该桥已开启；后台兜底码只用于桥接故障后的人工核验。

`DEPLOY_STAGE` 表示“已经完成验收的最高业务阶段”，不是“此刻是否接新订单”。进入会员或市场阶段后，即使临时停单也不要退回 `free` 或关闭支付 Provider，否则会影响历史订单回调与对账。

## 主机前置准备

- 在安装 systemd 单元前创建不可登录的 `pai-resume` 系统用户和同名用户组。
- 创建 `/opt/pai-resume/bin`、`/opt/pai-resume/releases`、`/etc/pai-resume` 和 `/var/log/pai-resume`；日志目录及运行所需目录由 `pai-resume` 用户可读写，环境文件仅服务账号可读且权限为 `0600`。
- 把当前版本的 `production-preflight.sh` 和 `switch-release.sh` 安装到不随版本软链接切换的 `/opt/pai-resume/bin`，归 root 所有并设为 `0755`。systemd 与回滚始终调用这份稳定控制脚本，不依赖目标旧版本是否包含预检脚本。
- 首次启动前执行 `nginx -t` 和 `systemd-analyze verify`；若用户、目录或权限缺失，不得继续切换版本。

## 发布前顺序

1. 从确定的提交或标签创建独立待发布目录，例如 `/opt/pai-resume/releases/版本号`；准备权限为 `0600` 的环境文件，先填写真实的 `VITE_SUPPORT_EMAIL`、`VITE_OPERATOR_NAME`、`VITE_AI_PROVIDER_NAME` 和 `VITE_AI_PROVIDER_PRIVACY_URL`。这些是前端构建期变量，不能等构建完成后再注入。
2. 在受控构建环境中加载该环境文件后运行前后端完整测试和构建，例如先执行 `set -a; source /etc/pai-resume/pai-resume.env; set +a`，再执行 `npm ci && npm run lint && npm run build`。环境文件中含空格的主体或服务商名称必须使用引号包裹。
3. 组装完整待发布目录。除 `dist/` 与后端 JAR 外，还必须保留 `scripts/export-resume-pdf.ts`、渲染器所需的 `src/`、`public/fonts/`、`config/` 和完整 `node_modules/`；当前服务端 PDF 导出依赖 `node_modules/.bin/tsx`，不能在发布前裁掉开发依赖。
4. 在临时空库运行全部 Flyway 迁移，并用最近一次备份完成恢复演练；确认 V19 的纯微信账号可为空邮箱/密码、V20 的人工精修价格仍为 `0`、V21 的邀请码领取表不保存邀请码或领取令牌明文，不得在迁移脚本中写入臆造价格。
5. 在已经加载环境文件的同一受控 shell 中，对待发布目录运行稳定预检：`RELEASE_ROOT=/opt/pai-resume/releases/版本号 /opt/pai-resume/bin/production-preflight.sh`。预检按 `DEPLOY_STAGE` 核对开放、验收、停单维护状态、运行时资产及 `dist` 中实际编译进去的客服、主体和 AI 服务商披露。
6. 使用 `/opt/pai-resume/bin/switch-release.sh` 切换 `current` 软链接；稳定切换脚本会在切换前强制对目标版本再次执行预检。systemd 启动前也会运行 `/opt/pai-resume/bin/production-preflight.sh`，防止跳过发布步骤后带占位密钥或错误业务开关启动。随后重启后端并加载、校验 Nginx 配置。
7. 运行 `scripts/smoke-production.sh`，核对首页、单页应用深链接、健康和就绪检查，并确认安全响应头、私有路由 `X-Robots-Tag` 与公开路由索引边界。

## 回滚

保留至少两个完整版本目录。应用发布失败时，用稳定控制目录中的 `/opt/pai-resume/bin/switch-release.sh` 校验并切回上一版本；目标版本无需自带新版预检脚本。数据库迁移必须保持向前兼容；需要回退数据时，只能使用演练过的备份恢复流程，禁止直接删除 Flyway 历史或手工回滚未知 SQL。

当前数据库迁移不创建存储过程或函数；备份脚本会备份表结构、表数据、触发器和事件，但不包含存储过程/函数。若未来引入数据库例程，必须同步升级并重新演练备份参数。

## 外部人工验收

- 域名解析、HTTPS 证书与自动续期。
- 备案、经营主体、微信商户和其他适用资质。
- 防火墙、Nginx、SSE 长连接、日志轮转及告警通知人。
- SMTP 的 SPF、DKIM、DMARC，以及主流邮箱真实投递。
- 派聪明服务号临时二维码生成、未关注扫码、已关注扫码、重复回调、过期挑战、一次性换票和注销重新扫码；同时验证 paicoding 回调签名和双方重放保护。
- 使用真实知识星球批次码验收 `/vip/claim`：输入邀请码不占名额，新用户扫码后先确认协议再领取，已有登录用户直接领取，二维码更新后旧码不能绑定，重复完成不重复核销，过期/作废/耗尽均失败且不泄露具体状态。
- 人工精修使用真实简历跑通自动保存、不可变 PDF、固定收件箱、邮件重试、首次核销、独立“沉默王二”关注奖励、后台处理与数据注销边界。
- 使用真实客服邮箱、运营主体和当前 AI 服务商披露重新构建前端，并真实验证客服邮箱收发与值守；只修改运行时环境文件不会改变已经生成的 `dist`。
- 会员支付开放前，微信支付回调公网可达并完成 `checklists/wechat-payment-acceptance.md` 全部场景。
- 生产年费会员固定使用 `MEMBERSHIP_PAYMENT_DAYS=365`；邀请码权益天数由后台逐批配置，不能复用该支付期限配置。
- 人工精修第三次及以后收费前，完成 `checklists/resume-review-acceptance.md`；未完成时保持价格 `0`、`RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS=false` 和验收确认位 `false`。
- 用户简历市场开放前，再完成 `checklists/marketplace-payment-acceptance.md` 的真实市场订单、退款反冲、作者收益、结算和治理值守验收。
