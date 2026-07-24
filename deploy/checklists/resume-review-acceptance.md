# 人工简历精修真实验收清单

本清单必须在隔离的预发布域名、测试账号、真实“派聪明”服务号、真实 SMTP 收件箱和真实微信商户下完成。正式生产未全部留证前，`RESUME_REVIEW_ENABLED`、`RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS` 与 `RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED` 必须保持 `false`，后台单价保持 `0`；隔离验收环境临时打开总开关时，四个 `RESUME_REVIEW_OSS_*_CONFIRMED` 必须全部严格为 `true`。

## 普通导出与 OSS 边界

- 普通“导出 PDF”由浏览器生成并直接下载；浏览器网络记录中没有服务端 PDF 渲染、人工精修上传或 OSS 请求，生产主机没有 Node/PDF worker 子进程和本地 PDF 文件。
- 只有用户进入人工精修、选择最终 PDF 并确认授权后才创建上传票据。在线简历后续编辑不会改变已经冻结的本次 PDF。
- 前端构建产物、源码映射、日志和错误信息中均没有预置或泄露 OSS AccessKey ID/Secret；短期直传响应只包含 POST 表单所需的非秘密 AccessKey ID、随机 staging key 所需字段和限制，绝不包含 AccessKey Secret 或长期密钥对。

## 私有 OSS 基础配置

- Bucket ACL 为 `private` 且阻止公共访问；匿名访问、猜测对象键和公共读 URL 均失败，没有公开读 CDN 或放宽访问的 Bucket Policy。
- 生产 CORS 只允许 `https://resume.paicoding.com` 发起 `POST`，允许请求头仅包含实际需要的 `content-type`；其他来源、`GET`、`DELETE` 和额外请求头均被浏览器预检或 OSS 拒绝。
- staging 与冻结对象前缀互不相同且互不包含。staging 生命周期最迟 1 天删除，冻结对象按 `RESUME_REVIEW_OSS_RETENTION_DAYS` 删除；若 Bucket 开启版本控制，历史版本与 delete marker 也在同一保留边界内清理。
- 应用 RAM 身份只对两个专用前缀拥有 `oss:GetObject`、`oss:PutObject`；`oss:DeleteObject`、`ListObjects`、`oss:*`、Bucket ACL/CORS/生命周期修改及其他 Bucket/前缀访问均被拒绝。配置 CORS 和生命周期使用独立运维身份，对象删除完全由生命周期规则负责。
- 读取真实 Bucket ACL、CORS、生命周期和 RAM Policy 留存脱敏 JSON 或截图，并完成上述负向测试后，四个 `RESUME_REVIEW_OSS_*_CONFIRMED` 才设为 `true`；仅修改确认位不算验收完成。

## 短期上传与服务端冻结

- 上传策略在配置的短 TTL 后失效，并精确限制服务端生成的随机 staging key、与声明字节数完全相等且不超过 10 MiB 的 `content-length-range`、`application/pdf`、声明的 SHA-256 元数据、私有 ACL 和 `AES256` 服务端加密。
- 使用同一凭证尝试修改 key、上传空文件/超限文件、修改 Content-Type、SHA 元数据、ACL 或加密字段时均被 OSS 拒绝；过期凭证也不能继续上传。
- 票据绑定当前账号和当前简历；另一账号、同账号另一份简历、伪造或已消费 `uploadNo` 均不能完成上传或创建申请。同一账号同时最多保留一个活动上传票据。
- `authorize` 与 `complete` 按动作分别计数，并同时命中账号/IP 双预算；分别压满账号预算、共享 IP 预算后返回限流错误，窗口到期恢复。验收还需确认 IP 预算不小于账号预算，且 Redis key/日志中不出现原始用户简历、AccessKey Secret 或不必要的敏感数据。
- 完成接口从 OSS 流式读取 staging 一次并执行服务端校验：字节数、`application/pdf`、完整 SHA-256、SHA 元数据和开头 `%PDF-` 任一不一致都拒绝，不创建申请、不扣免费次数、不创建支付订单，也不在服务器落盘。
- 将完成冻结并发占满到 `RESUME_REVIEW_OSS_MAX_CONCURRENT_FINALIZATIONS` 后，额外请求立即返回 503，不进入等待队列、不长期持有数据库连接；已有任务完成后可正常重试。生产配置低于 1 或高于 16 时预检和应用启动都拒绝。
- 校验通过后按源 ETag 在 OSS 内复制到新的随机冻结 key，保存对象 key、ETag、原文件名、字节数、SHA-256 和上传时间；冻结对象 key 不返回浏览器，也没有修改/覆盖接口。staging 不在业务事务中立即删除，完成接口或数据库事务失败时可安全重试，最迟由独立短生命周期规则清理。
- 完成接口与创建申请均可安全重试，不会产生两个冻结对象、两笔申请或重复扣次数；`READY` 票据超时后不能再创建申请。
- 主动中断浏览器上传、上传成功但未调用完成接口、完成前并发替换 staging、OSS 超时和服务端重启均按预期失败关闭；残留 staging 最终由生命周期清理。

## 首次免费

- 首次提交前最后一次编辑已可靠落盘；用户选择的 PDF、OSS 冻结对象、数据库 SHA-256/大小和邮件附件逐字节一致。
- 联系邮箱验证码、人工处理授权和发送到固定私密邮箱授权均经过真实路径。
- SMTP 首次失败时不核销免费次数；重试被服务器接受后只核销一次，固定 Message-ID 不变。
- 已经核销首次免费机会后，不再签发任何关注奖励或后台兜底免费码。

## 第二次及以后逐单付费

- 单价为 `0`、支付 Provider 未启用、独立新单开关关闭或验收确认位为 `false` 时，第二次请求必须失败关闭，不能回退成免费提交。
- 管理员明确设置真实单价后，订单金额、币种、AppID、商户号和订单前缀 `PS` 均与商户平台一致。
- 完成 Native 下单、回调验签、主动查单、二维码过期、关单后二次查单、丢失回调补偿和重复通知。
- 支付成功只触发一封邮件和一次次数核销；每次后续请求都创建独立订单，不存在包月或无限次歧义。
- 到期前支付正常投递；迟到支付、活动请求失效后支付进入 `REFUND_REQUIRED`，不得继续投递。
- 在微信商户平台完成真实全额退款后，后台填写唯一退款流水并确认；重复确认和伪造流水均被拒绝。

## 人工处理与隐私

- 邮件 outbox 只有一个 worker 顺序处理；每次发信前服务端从私有 OSS 临时读取冻结对象一次到 JVM 内存，受大小上限保护并复核完整 SHA-256。进程退出后服务器磁盘、release、日志和临时目录均没有 PDF 副本，且没有启动 Node/PDF worker。
- 确定性附件校验失败时立即停止自动重试；可重试的 OSS/SMTP 故障在达到 `RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS` 后停止自动重试并留下审计记录，不再持续消耗服务器或上游资源。
- 篡改或提前删除冻结对象时邮件投递必须失败关闭并告警，不能发送其他文件、空附件或绕过校验；修复后重试仍使用同一数据库对象引用和固定 Message-ID。
- 管理后台在自动重试停止后仍可执行显式手动重试或退回，并完成接受、完成、退款确认及审计查询；所有状态迁移符合服务端规则。
- 已被 SMTP 接受的免费邮件即使退回也不恢复次数；付费退回先进入退款复核。
- 固定收件箱已启用最小权限、双因素认证和留存/删除制度；邮件中无访问令牌、模型完整返回或不必要的敏感日志。
- 账号注销会阻止仍在投递、精修或退款中的请求；终态请求的快照和联系邮箱按规则匿名化，已投递邮箱副本的不可召回边界已向用户披露。

以上项目均有订单号、时间、脱敏日志、邮件头或商户平台截图留存后，才可设置 `RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED=true`。正式接单前再次核对后台单价并单独开启 `RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS=true`。
