# PaiResume 开发与测试缺口清单

> 审计日期：2026-08-18  
> 用途：作为后续逐条开发、测试和验收的工作清单。  
> 原则：代码已实现、自动化测试通过、真实外部链路验收、生产部署是四种不同状态，不互相替代。

## 状态说明

- `待处理`：尚未开始本轮工作。
- `开发中`：工作区已有代码，但尚未完成全部测试和验收。
- `代码完成待验收`：主要代码已经存在，但真实外部链路尚未验收。
- `运维待办`：需要生产或基础设施操作，不能只靠本地代码完成。
- `完成`：实现、必要测试和对应验收均已有证据。

## 当前基线

- 当前分支：`main`，审计时与 `origin/main` 指向同一提交。
- 工作区已有未提交开发：35 个已修改文件、14 个未跟踪文件。
- 当前开发主题主要包括：
  - 按求职场景配置简历分析 Prompt。
  - 用户选择工作党、日常实习、暑期实习、秋招四种分析场景。
  - 管理后台维护各场景 Prompt。
  - 官方精选简历区分完全公开和付费会员查看。
- 审计过程未修改既有源文件，只新增本清单。

## 第一阶段：收口当前工作区改动

### DEV-001 简历分析 Prompt 配置服务测试

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 当前实现：`ResumeAnalysisPromptConfigServiceImpl` 已支持列表、场景解析和更新。
- 本轮补充：
  - 服务边界新增守卫：Prompt 超过 12000 字符在服务层直接拒绝（此前仅有 DTO 注解校验）；`updateById` 返回行数不为 1 时失败关闭，不再静默成功。限制常量统一放在 `ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH`，DTO 注解引用同一常量。
  - 新增 `ResumeAnalysisPromptConfigServiceImplTest`（13 项）：固定顺序、缺行/空 Prompt 失败关闭、编码大小写与首尾空格、非法/空白编码、保存去空白并记录管理员、空 Prompt 拒绝、超长拒绝、数据库异常传播、零行更新失败关闭、更新时配置缺失失败关闭。
  - 新增 `UpdateResumeAnalysisPromptDTOTest`（1 项）：接口边界空值、空白与 12000/12001 长度校验。
- 验证结果：新增 14 项与相关既有 11 项测试（`AdminControllerSecurityTest`、`AiServiceImplResumeAnalysisPromptTest`、`ResumeAnalysisPromptMigrationContractTest`）全部通过，Maven 编译通过，`git diff --check` 通过。

### DEV-002 简历分析接口与 SSE 契约测试

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 当前实现：`ResumeAnalysisController` 已接入求职场景，并把场景写入分析结果和记录。
- 本轮补充：
  - 新增 `ResumeAnalysisControllerContractTest`（20 项）：未登录、非 VIP、简历不存在、越权、已删除简历、空白/非法场景、空简历拒绝；普通接口确认只使用后台配置 Prompt、结果场景字段由服务端覆写、成功与失败记录完整持久化；SSE 成功路径 `connected → status → reasoning_delta → content_delta → result → done` 事件顺序与内容、AI 业务异常和未知异常的 `error` 事件与错误记录；`latest` 接口场景恢复与归属校验。
  - 新增 `ResumeAnalysisRecordServiceImplTest`（4 项）：最近记录按存储场景编码恢复 canonical 编码与名称、无场景记录默认值、无记录返回 null、save 语义。
  - 契约测试暴露并修复一个真实缺陷：SSE 端点在流开始前的失败（非 VIP、越权、空简历、非法场景）因 `Accept: text/event-stream` 内容协商限制返回空响应体，前端只能显示“请求失败（HTTP 403）”等兜底文案。现改为统一以 SSE `error` 事件输出真实 code 和消息，与流中途 AI 失败行为一致；错误记录只在已有场景上下文时保存。普通接口仍返回 JSON 错误。
- 验证结果：新增 24 项测试全部通过，Maven 编译通过，`git diff --check` 通过。

### DEV-003 分析场景前端交互测试

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 已有测试：验证用户只能选择求职场景，并能以 `WORKING_PROFESSIONAL` 发起分析。
- 本轮补充：
  - `ResumeAnalysis.test.tsx` 由 1 项扩展到 11 项：四种场景分别发送正确编码、选择写入 localStorage 并在重新挂载后恢复、非法 localStorage 值不被采用（按钮保持禁用且不发起请求）、最近分析结果恢复对应场景选择、分析结果显示对应场景名称（如“简历得分 · 学生党找暑期实习 - 良好”）、失败时展示错误提示、重新分析沿用当前场景。
  - 新增 `useAnalysis.test.tsx`（6 项）：流式 `status/reasoning_delta/content_delta/result` 事件按序更新状态并在成功后写入结果、失败展示错误并复位加载状态、重新分析先清空上一次结果、`loadLatestAnalysis` 成功与失败路径、`resetAnalysis` 清空全部状态。
  - 审计清单中的“中止”经核实当前没有真实入口：`useAnalysis` 从不向 `analyzeStream` 传递 AbortSignal，页面也没有取消按钮（全站仅 FieldOptimizePage 接入了中止）。该路径无法在真实执行路径上验收，如需支持分析中途取消属于新增产品能力，未在本轮实现。
- 验证结果：前端分析相关 Vitest 17 项通过（组件 11 项、hook 6 项），TypeScript 编译、相关 ESLint、`git diff --check` 通过。

### DEV-004 管理后台 Prompt 面板交互测试

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 当前实现：后台页面可以加载、切换和保存四个场景的 Prompt。
- 本轮补充：
  - 新增 `tests/components/admin/ResumeAnalysisPromptAdminPanel.test.tsx`（11 项）：初次加载默认选中第一个场景、加载失败展示错误、空列表不渲染面板、切换场景分别保留未保存草稿、改回原文后保存恢复禁用、清空提示词保存禁用、保存中禁用并显示“保存中…”、保存成功后更新基线与成功状态、保存失败保留草稿并允许重试、12000 字符边界（超限禁用并提示、恰好 12000 允许保存）。
  - 测试暴露并修复一个真实缺陷：加载失败的错误提示渲染在依赖激活场景的分支内，configs 为空时错误被吞掉、页面无任何反馈。错误提示已移到面板外层常显。
  - 面板补上 12000 字符客户端守卫：此前超长内容会原样提交、只能收到笼统的“分析提示词保存失败”；现在超过 12000 字符（按提交的 trim 后内容计算）时保存禁用并显示与后端一致的提示。
- 验证结果：面板 11 项通过；受组件改动影响的 `AdminPage.test.tsx` 35 项通过；TypeScript 编译、相关 ESLint、`git diff --check` 通过。

### DEV-005 V30 真实 MySQL 迁移验证

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 当前情况：SQL 静态契约测试通过；`RealMySqlMigrationTest` 因本机未配置专用测试库而跳过。
- 本轮补充与验证：
  - `RealMySqlMigrationTest` 新增断言：`resume_analysis_record` 上 `idx_resume_analysis_scenario`（scenario_code, created_at）复合索引存在；四条种子 Prompt 齐全、编码与名称正确、内容非空且 `updated_by` 为 NULL；迁移到 V30 后再次执行迁移应用脚本数为 0（等价于应用重启不破坏种子配置）；两条历史会员订单的 user、状态、金额、币种在迁移后保持不变。
  - 使用本机 MySQL 8.0.42 的一次性隔离库 `pai_resume_migration_test` 真实执行：V5 baseline → V23 → 注入历史订单 → V30 → 二次迁移，测试通过（1 项，未跳过）。
  - 库内独立留证：`flyway_schema_history` 当前版本 30；四条 Prompt 长度 338/217/215/238 字符；复合索引存在；两条历史订单保留。验证后已删除隔离库。
  - 复现方式：新建空库后运行 `PAIRESUME_TEST_MYSQL_URL='jdbc:mysql://127.0.0.1:3306/<空库名>?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true' PAIRESUME_TEST_MYSQL_USERNAME=… PAIRESUME_TEST_MYSQL_PASSWORD=… mvn test -Dtest=RealMySqlMigrationTest`；测试对已用过的库不幂等（历史订单主键冲突），每次运行需全新空库。
- 验证结果：真实 MySQL 迁移 1 项通过（含新增断言），Maven 编译与 `git diff --check` 通过。

### DEV-006 当前功能本地浏览器冒烟

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 环境与准备：
  - 后端以 `APP_ENV=development` 在本机 8084 启动（复用根目录 `.env` 的 MySQL/Redis/JWT 配置，补照片 OSS 占位值通过启动校验）；前端 Vite 5173 经 `/api` 代理；本机 MySQL 8.0.42 开发库 `pai_resume`（已处于 V30）。
  - AI 采用受控 mock：本地 127.0.0.1:4567 的 OpenAI 兼容服务，按请求内容返回固定分析 JSON 或展示元数据 JSON，未消耗真实额度。mock 初版未覆盖展示元数据格式，精选时被后端校验拒绝（400，日志"AI 返回内容格式异常"），补齐后验证通过——该错误已解释，非产品缺陷。
  - test 账号（test@example.com）会员状态临时 FREE→验证→还原为原值（ACTIVE 至 2026-09-20）；冒烟后 showcase、Prompt 配置均已还原，分析记录为真实执行产物予以保留。
- 冒烟结果（全部通过）：
  - 匿名：VIP 精选详情仅截断预览，public API 返回 7008，"查看简历"跳登录；FREE 精选（管理员发布后）匿名可见完整正文（API 200 + 4 模块 + 页面 PDF 渲染）。
  - FREE 用户：VIP 精选跳会员购买页；`/admin` 页面重定向 dashboard；带真实 access token 调管理 Prompt 接口返回 403；编辑器"简历分析"入口被 VIP 守卫拦截（后端 4006 拦截已由 DEV-002 契约测试覆盖）。会员页支付按钮 disabled、月卡/终身"待开放"，与收款开关关闭状态一致。
  - VIP 用户：受控 AI 分析（学生党找暑期实习）完整走通，得分 91（mock 82 经 `recalibrateAnalysisScore` 校准，落库与显示一致）、问题、建议、场景名正确；落库记录确认使用后台配置 Prompt；刷新页面后 latest 结果与场景选择完整恢复；VIP 精选正文以客户端生成的 PDF 图片完整渲染（1118×2345）。
  - 管理员：Prompt 面板加载四场景、默认选工作党、保存成功（落库 updated_by=20）、切换场景草稿互不丢失、还原保存成功；官方样例简历以"完全公开"发布成功（AI 元数据生成、校验、落库），验证后还原 DRAFT。
- 过程说明：笔记本睡眠导致一次时间跳跃（Hikari clock leap 告警、浏览器守护进程临时断连），恢复后全部命令正常；日志与控制台中的 401/403/7008 均为本次故意触发的权限测试，无未解释错误。
- 验证结果：浏览器页面、网络请求、控制台与后端日志检查完毕，无未解释错误；环境（后端、前端、mock、浏览器会话）已全部关闭，`git diff --check` 通过。

## 第二阶段：免费主链路质量门禁

### QA-001 自动保存竞态测试

- 状态：`完成`（2026-08-18）
- 优先级：P0
- 当前实现：已有防抖保存、本地草稿、保存队列、全局 flush、`pagehide`、`beforeunload`、`visibilitychange` 和组件卸载处理。
- 本轮补充：
  - 新增 `tests/components/editor/useAutoSave.test.tsx`（13 项）：1.5 秒防抖边界（1499ms 不保存、到期保存一次并清理草稿）、防抖期连续编辑只保存最后一版、`markSaved` 基线去重、保存进行中再次编辑的竞态（慢请求完成时状态保持 dirty、新内容随后落盘、调用顺序正确）、防抖期内切换模块经卸载清理立即保存旧模块、`flushResumeAutoSaves` 按简历前缀汇总且任一模块失败整体失败（其他简历不受影响）、页面隐藏触发保存、`beforeunload` 有未保存内容时阻止并保存且无变更不阻止、卸载与 `pagehide` 触发保存、本地草稿恢复与损坏草稿清理（非法 JSON、content 非对象）、localStorage 不可用不中断服务端保存、保存失败进入 error 且 flush 可重试。
  - EditorPage 三个阻断调用点（PDF 导出、模块排序、会员页跳转均先 `await flushResumeAutoSaves`，失败即中断后续动作）通过上述失败传播契约与代码审阅共同覆盖；EditorPage 组件级测试未新增，原因是其渲染依赖过重，性价比低于 hook 契约测试。
- 验证结果：13 项 Vitest 通过，TypeScript 编译、相关 ESLint、`git diff --check` 通过。

### QA-002 浏览器端 PDF 导出回归

- 状态：`完成`（2026-08-19）
- 优先级：P1
- 本轮验证：
  - 自动化测试：新增 `tests/resume/downloadResumePdf.test.ts`（node --test，2 项）——`downloadResumePdf` 客户端生成 blob 后触发 `a[download]` 点击并释放对象 URL；`generateResumePdfBlob` 产出真实 `%PDF-` 字节流（node 环境真实字体渲染）。既有 `awardPdf`、`experiencePdf` 等渲染层测试继续覆盖分项内容。
  - 真实浏览器验证（本地前后端 + 登录用户）：点击"导出 PDF"后网络请求只有 `GET /api/resumes/43/modules`（导出前 flush 自动保存后重新读取最新模块，与 EditorPage 代码路径一致）和浏览器本地 `fetch /fonts/noto-sans-sc-*.otf` 字体加载，**无任何服务端 PDF 渲染接口调用**。
  - 浏览器内内容抽查（页面内调用真实导出管线 + PDFJS 解析）：标准模式 6 页 241KB，文本含姓名、教育背景，首部为"姓名：沉默王二求职意向：AI应用开发工程师…"；智能长一页（内容无损）模式压缩为 2 长页。
  - 发布包静态检查：`build-release.sh` 制品契约仅 `dist/`、单个后端 JAR、`config/` 与 manifest，不含 Node、`node_modules`、PDF worker、源码；systemd unit `ExecStart` 仅 `java -jar`。生产主机现场核查仍属 PROD-002 运维范围。
  - 覆盖边界：页面模式验证了标准与智能长一页两种；8 个模板和照片场景未逐一浏览器验证（模板渲染已有预览面板即时可见性保障），如需可后续补充。
- 验证结果：node --test 2 项通过；浏览器导出、网络、内容抽查全部符合预期；`git diff --check` 通过。

### QA-003 页面级 E2E 基线

- 状态：`完成`（2026-08-19，范围：首批建议的本地可自动化部分）
- 优先级：P1
- 本轮补充：
  - 新增 Playwright E2E 基础设施：`playwright.config.ts`（单 worker、指向本地 5173/8084、trace 留失败现场）、`e2e/global-setup.ts`（前后端就绪探测，未启动时给出明确指引，禁止对生产运行）、`npm run test:e2e` 脚本、`.gitignore` 增加 test-results。
  - 首批 6 项全部通过（13 秒）：登录后刷新保持登录态并退出回未登录；未注册邮箱请求重置不暴露账号存在性（找回密码的隐私前置行为）；账号注销按钮受确认文字与密码双重前置约束（不触发真实注销）；创建简历→编辑姓名→自动保存→刷新恢复；管理员登录后 `/admin?view=analysis-prompts` 深链直达；普通用户访问管理深链被弹回工作台。
  - 顺带发现的可访问性缺陷（已记录待改）：`BasicInfoForm` 字段 label 未通过 `htmlFor` 关联输入框，可访问名称缺失（E2E 用顺序定位绕过）。
  - 覆盖边界：邮箱注册完整链路本地无法自动化（验证码走真实 SMTP 邮件），扫码注册因扫码桥关闭同样不可用；VIP 邀请码领取（已有邮箱账号路径）与真实导出下载落盘未纳入首批，待后续补充。E2E 未接入 CI（`.github/workflows/ci.yml` 仍为 npm test + mvn test），接入需先解决 CI 内 MySQL/Redis 服务编排，属于后续 CI 工程。
- 验证结果：`npm run test:e2e` 6/6 通过；测试创建的简历已从开发库清理；ESLint、TypeScript、`git diff --check` 通过。

## 第三阶段：尚未开发完成的产品与运维能力

### PROD-001 管理后台 AI 服务商安全配置

- 状态：`完成`（2026-08-19，实现与本地验收；生产 0600 环境文件落地属部署事项）
- 优先级：P1
- 本轮实现：
  - 迁移 V31：`ai_provider_config` 单行配置表（含 CHECK 约束）+ `ai_provider_config_audit` 审计表；种子行 DeepSeek、默认关闭、不带密钥。真实 MySQL 8 空库迁移到 V31 验证通过（含二次迁移无脚本应用、种子行断言）。
  - `AiProviderCryptoService`：AES-256-GCM（随机 12 字节 IV + 128 位认证标签），主密钥仅来自 `AI_PROVIDER_MASTER_KEY`（Base64 32 字节，环境文件）；密文篡改、无主密钥、非法密钥格式均失败关闭；掩码规则保留前 4 后 4，短值全掩。
  - `AiProviderConfigService`：查询只返回掩码与 `apiKeyConfigured/masterKeyConfigured` 标志（无明文/密文字段）；API Key 留空保留原密文与掩码、非空才加密轮换；未配主密钥保存加密 Key 或启用无任何 Key 均拒绝；`displayName/privacyPolicyUrl` 变更且启用时重置全部用户的 AI 处理披露版本（触发重新同意）；连接测试（GET /models，10 秒超时）与配置变更均写审计且审计不含敏感值；生效配置带内存缓存，保存后失效；关闭时回退环境变量。
  - `AiServiceImpl` 改为经 `resolveActive()` 取 Key/Base URL/模型（原 4 个 `@Value` 字段移除），全部 AI 调用走统一动态配置。
  - 管理 `/admin/ai-provider` GET/PUT/POST test 三接口 + 前端 `AiProviderAdminPanel`（掩码展示、留空保留、连接测试、主密钥缺失告警）+ 后台导航与加载计划接入。
- 测试与验收：
  - 后端 23 项新测试全绿：`AiProviderConfigServiceImplTest` 11 项（掩码、空 Key 保留、轮换、双重启用守卫、无主密钥失败关闭、披露联动开/关、缓存命中与失效、真实 HttpServer 连接测试审计脱敏）+ `AiProviderCryptoServiceTest` 6 项 + `AdminAiProviderControllerSecurityTest` 6 项（401/403/管理员、响应不含明文与密文、字段校验前置）。回归 36 项既有相关测试通过。
  - 前端 `AiProviderAdminPanel` 组件测试 7 项通过；导航/加载计划测试更新后 6 项通过；TypeScript、ESLint、`git diff --check` 通过。
  - 浏览器验收：管理员在面板保存 mock 地址 + 测试 Key 并启用，落库密文 52 字节、掩码 `sk-s••••1234`、审计 changed_fields=baseUrl,enabled,apiKey 且 rotated=1；连接测试“连接成功（50ms）”；test 用户发起简历分析，mock 收到请求且 `model=deepseek-chat`（数据库配置的分析模型，而非环境变量回退值 glm-4.5-air），SSE result/done 正常——动态配置端到端生效。后端日志全文无 API Key 明文。验收后配置已还原种子状态，环境已清理。
- 待部署边界：生产启用前需在 0600 环境文件配置 `AI_PROVIDER_MASTER_KEY` 并做一次真实服务商连接测试；轮换演练与协议版本生产验证随上线清单执行。

### PROD-002 生产监控、告警与异机备份

- 状态：`运维待办`
- 优先级：P1
- 尚缺能力：
  - 日志轮转。
  - CPU、内存、磁盘、数据库连接和备份失败告警。
  - ready-check 连续失败、支付对账失败、待退款等业务告警。
  - 告警真实送达值班人。
  - 数据库备份异机副本及周期恢复演练。
- 完成标准：制造受控故障并确认告警送达；异机备份能够在隔离数据库完成恢复。

### PROD-003 生产预览 iframe 响应头修复

- 状态：`运维待办`
- 优先级：P1
- 当前情况：仓库 Nginx 模板已经为 `/preview/:id` 配置 `SAMEORIGIN`，生产记录仍显示该路径曾返回 `DENY`。
- 完成标准：生产执行 `nginx -t`、受控 reload；编辑器同域预览正常，其他页面继续禁止 iframe，并完成公网冒烟。

### PROD-004 派聪明扫码桥

- 状态：`代码完成待验收`
- 优先级：P1
- 当前情况：PaiResume 接收与校验代码已有，paicoding 生产桥接 endpoint 尚未发布，生产继续使用邮箱兼容登录。
- 尚缺工作：
  - 发布 paicoding HMAC 桥接 endpoint。
  - 配置独立双向密钥和真实 AppID。
  - 验证签名、重放保护、过期挑战和一次性换票。
  - 验证未关注扫码、已关注扫码、重复回调和注销重新扫码。
  - 验证扫码绑定后的知识星球 VIP 领取。
- 完成标准：真实服务号链路留证后才能开启 `PAICONGMING_WECHAT_LOGIN_ENABLED`。

### PROD-005 Redis systemd 纳管

- 状态：`运维待办`
- 优先级：P2
- 当前情况：共享 Redis 6388 仍由 root 在登录 session 中手工启动，现有 unit 不能正确停止该实例。
- 完成标准：单独维护窗口完成认证 BGSAVE、备份校验、回滚方案、正确 unit、启动停止验证和共享业务回归。不得直接执行现有 `systemctl start redis`。

## 第四阶段：真实收费与服务闭环

### ACCEPT-001 会员微信支付真实验收

- 状态：`代码完成待验收`
- 优先级：P2
- 验收文件：`deploy/checklists/wechat-payment-acceptance.md`
- 核心范围：真实 Native 下单、回调、主动查单、超时关单、迟到支付、重复通知、退款、异常订单、告警和权益幂等。
- 完成标准：清单全部留证后，只开启会员支付，用户市场继续关闭。

### ACCEPT-002 人工精修 OSS、邮件与逐单付费验收

- 状态：`代码完成待验收`
- 优先级：P3
- 验收文件：`deploy/checklists/resume-review-acceptance.md`
- 核心范围：私有 OSS、精确 CORS、生命周期、RAM 最小权限、短期 POST Policy、冻结对象、逐单付费、可选加急金额、邮件附件、失败重试和退款。
- 完成标准：清单全部留证，四个 OSS 确认位为真实证据支撑的 `true`，再单独开启人工精修和后续付费新单。

### ACCEPT-003 用户付费简历市场验收

- 状态：`代码完成待验收`
- 优先级：P4
- 验收文件：`deploy/checklists/marketplace-payment-acceptance.md`
- 前置条件：会员支付稳定运行，内容治理和值班人员已落实。
- 核心范围：先审后发、正文权限、真实订单、不可变版本、迟到支付、退款撤权、收益冻结与反冲、结算、举报、侵权投诉和申诉。
- 完成标准：清单全部留证后才允许打开市场及市场支付新单开关。

## 第五阶段：低优先级技术与体验债务

### DEBT-001 标准业务页面统一 Footer

- 状态：`完成`（2026-08-19）
- 优先级：P4
- 本轮处理：
  - 页面分类：首页（已接 Footer，冻结不动）；政策页 privacy/terms/refund-policy/customer-service（已接 Footer）；标准公开业务页 `ExcellentResumesPage`（优质简历列表）、`ShowcasePage`（精选详情）、`MarketplaceResumePage`（市场详情）、`SurveyPage`（问卷）本轮统一接入 `SiteFooter`；登录/找回密码/协议确认、工作台、会员、编辑器、预览、字段优化、后台、`/vip/claim` 领取流程等沉浸式/流程页不加。
  - 移动端浏览器检查（375×812）：优质简历列表、精选详情、问卷页 Footer 均正常渲染（堆叠布局高 678px）、无横向溢出；桌面端（1440×900）Footer 314px 居中正常。市场详情页因开发库无已发布 listing 未做真实页面检查（接入方式与其他页面一致，TypeScript/ESLint 通过），留待有真实数据时顺带核对。
  - 顺带发现（已记录，未改）：`PolicyPages` 的用户披露文案（`AI_PROVIDER_NAME`、`AI_PROVIDER_PRIVACY_URL`）是构建时常量，与 PROD-001 的后台动态服务商配置存在同步缺口——后台切换服务商后用户重新同意时看到的仍是构建时名称；生产上线前应让披露页读取服务端当前配置或把"构建注入真实服务商名"纳入发布检查。
- 验证结果：TypeScript、相关 ESLint、Vitest 组件回归 117 项、`git diff --check` 通过。

### DEBT-002 前端大包拆分

- 状态：`待处理`
- 优先级：P4
- 当前构建观察：`resumePdf` 约 1.6 MB，PDF worker 约 1.38 MB，Vite 提示部分 chunk 超过 500 kB。
- 完成标准：按真实首屏和编辑器性能数据决定是否拆包；不得只为消除警告盲目重构。

### DEBT-003 更新项目状态文档

- 状态：`完成`（2026-08-19）
- 优先级：P2
- 本轮更新：
  - 为获得真实数字执行了一次全量测试：后端 `mvn test` 538 项通过、1 项 opt-in 真实迁移测试跳过（隔离 MySQL 下已单独验证）；前端 Vitest 117 项、node 单元 99 项、Playwright E2E 6 项通过。过程中发现 `experiencePdf.test.ts` 一项存量失败（经 `git stash` 在干净 HEAD 上复现，与本轮改动无关，为 PDF 文本层空格与断言不匹配），已将断言改为空白容错修复。
  - `TODO.md`：测试数量 249 → 538（含前端 117+99+E2E 6），迁移版本 V18 → V31，补记 V30/V31 迁移验收内容、2026-08 新增能力（四场景分析、AI 服务商加密配置、SSE 错误契约、E2E 基线）与"生产仍为 V23 首发、本地 V24-V31 未发布"的边界。
  - `deploy/production-deployment-decisions.md`：追加"本地开发快照（2026-08-19）"一节，记录本地 V31、全量测试数字与未发布边界；历史记录未改动。
- 验证结果：全量前后端测试通过（含修复后的 experiencePdf），`git diff --check` 通过。

## 本次审计已执行的验证

- 前端相关 Vitest：42 项通过。
- 后台导航和加载计划：6 项通过。
- 后端相关测试：34 项通过。
- `RealMySqlMigrationTest`：1 项因未配置隔离 MySQL 而跳过。
- TypeScript 编译：通过。
- 相关 ESLint：通过。
- `npm run build`：通过，存在大 chunk 警告。
- `git diff --check`：通过。
- 本轮没有运行完整前端或后端测试套件，没有执行生产操作。

## 建议逐条处理顺序

> 2026-08-19 处理结果：清单中所有可本地完成的条目已全部处理——`DEV-001`~`DEV-006`、`QA-001`~`QA-003`、`PROD-001`、`DEBT-001`、`DEBT-003` 均为 `完成`；`DEBT-002` 按其完成标准需真实首屏/编辑器性能数据支撑，未盲目重构。剩余 `PROD-002`/`PROD-003`/`PROD-005`（生产运维操作）、`PROD-004`（需先发布 paicoding 扫码桥）、`ACCEPT-001`~`ACCEPT-003`（真实商户与生产验收）均需生产环境或外部系统，本地无法推进。
>
> 本轮修复的真实缺陷：SSE 流前失败返回空响应体（改为 error 事件）、Prompt 面板加载失败错误被吞、服务层缺少超长与零行更新守卫、管理面板缺少 12000 字符限制、`experiencePdf` 存量断言对 PDF 文本空格不容错。另记录两个待办发现：简历分析无用户可达的取消入口（无 AbortSignal 传递）；政策页 AI 服务商披露文案为构建时常量、与后台动态配置存在同步缺口。
>
> 2026-08-20 追加（两个发现的落地）：① 简历分析取消入口——`useAnalysis` 增加 AbortController 与 `cancelAnalysis`（重复发起自动中止上一次、AbortError 静默复位不展示错误、结果与中止竞态时丢弃迟到结果），分析中界面显示"取消分析"按钮；hook 7 项 + 组件 13 项测试，浏览器实测慢速流下取消后状态干净复位、重新分析完整走通。② AI 披露与后台配置联动——新增公开接口 `GET /public/ai-disclosure`（启用时返回数据库服务商名与隐私链接，未启用回退 `AI_PROVIDER_NAME`/`AI_PROVIDER_PRIVACY_URL` 环境变量），后台保存隐私链接强制 HTTPS 校验；前端 `useAiProviderDisclosure` 供政策页与协议确认页读取服务端当前值，服务端不可用或非 HTTPS 时回退构建常量（构建注入校验语义不变）；后端 3 项新测试 + hook 4 项测试，浏览器实测政策页展示服务端下发值。
>
> 全量测试快照（2026-08-19）：后端 `mvn test` 538 项通过、1 项 opt-in 迁移跳过；前端 Vitest 117 项、node 单元 99 项、Playwright E2E 6 项通过。所有改动保留在工作区未提交。

1. `DEV-001` Prompt 配置服务测试。
2. `DEV-002` 分析接口与 SSE 契约测试。
3. `DEV-003` 分析场景前端测试。
4. `DEV-004` 管理后台 Prompt 面板测试。
5. `DEV-005` V30 真实 MySQL 迁移。
6. `DEV-006` 当前功能本地浏览器冒烟。
7. `QA-001` 自动保存竞态测试。
8. `QA-002` 浏览器 PDF 导出回归。
9. `QA-003` 页面级 E2E 基线。
10. `PROD-001` 至 `PROD-005`。
11. `ACCEPT-001` 会员支付。
12. `ACCEPT-002` 人工精修。
13. `ACCEPT-003` 用户付费简历市场。
14. `DEBT-001` 至 `DEBT-003`。
