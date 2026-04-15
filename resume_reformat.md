# 基本信息

姓名：沉默王二
求职意向：AI应用开发工程师
邮箱：qing_gee@163.com
GitHub：https://github.com/itwanger/  
博客：https://javabetter.cn  
籍贯：河南

## 教育背景

### 郑州大学

- 学历：硕士
- 时间：2024年9月 - 2027年6月
- 院系：计算机
- 专业：计算机科学与技术
- 标签：211
- 奖项：国家励志奖学金（2025年）

### 郑州大学

- 学历：本科
- 时间：2020年9月 - 2024年6月
- 院系：计算机
- 专业：计算机科学与技术
- 标签：211
- 奖项：国家励志奖学金（2023年）

## 实习经历

### 淘宝闪购｜Agent开发｜PaiAgent/PaiFlow 2026-03 ～ 至今

项目简介：基于 LangGraph4j + Spring AI 的企业级 AI 工作流平台，支持通过可视化拖拽界面编排多种大模型和工具节点，使用状态图引擎执行复杂 AI 任务。

技术栈：Java 21、Spring Boot 3.4、Spring AI 1.0、LangGraph4j 1.8、React 18、ReactFlow

1. 基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。
2. 设计 ChatClientFactory 动态工厂，运行时根据节点配置动态创建 OpenAI 兼容的 ChatClient，实现 OpenAI、DeepSeek、通义千问等多厂商 LLM 无缝切换。
3. 使用模板方法模式重构 5 个 LLM 节点执行器，抽象 AbstractLLMNodeExecutor 基类，子类仅需实现 getNodeType()，代码量从 800+ 行精简至每个 10 行。
4. 实现 Skill 预置知识包机制，支持 SkillRegistry 自动加载、Reference 缓存、全量/渐进式两种注入模式。
5. 实现 DAG 工作流解析引擎，基于 Kahn 算法的拓扑排序确定节点执行顺序，DFS 深度优先搜索检测循环依赖防止死锁，支持一对多、多对一的节点连接方式
6. 实现 Prompt 支持模板变量替换，可通过 {{variable}} 解析 input 静态值和 reference 动态引用两种参数类型，支持从上游节点输出中自动获取参数值，实现节点间数据流的灵活映射
7. 实现 TTS 语音合成节点，支持 UTF-8 字节级文本分段、标点断句、并行合成、WAV 格式合并。
8. 编写并优化 Docker Compose 编排脚本 ，统一管理 MySQL、Redis、MinIO、Console Hub 及 Workflow Engine 等 5+ 个核心服务的依赖关系与健康检查，实现了“一键拉起”开发环境，将本地环境搭建时间从小时级降低至 30 分钟以内。
9. 设计了 LlmChatHistory 组件，支持动态组装 SystemMessage 、 UserMessage 与 AssistantMessage ；并基于 Token 滑动窗口实现了历史记录截断策略，在有限的 Context Window 内最大化保留对话上下文，有效解决长对话场景下的 Token 溢出问题。
10. 编写并优化 Docker Compose 编排脚本 ，统一管理 MySQL、Redis、MinIO、Console Hub 及 Workflow Engine 等 5+ 个核心服务的依赖关系与健康检查，实现了“一键拉起”开发环境，将本地环境搭建时间从小时级降低至 30 分钟以内。
11. 在 Link 客户端中实现了动态 URL 构建与 Header 注入机制，支持通过 HTTP 协议调用远程 OpenAPI 工具；结合 OkHttp 的拦截器机制 ，统一处理鉴权签名、请求日志记录及超时重试逻辑，为上层业务提供 RPC 能力。支持 API Key（header+query），以及 Bearer Token 三种鉴权方式。
12. 深度集成 Spring AI 框架，通过 OpenAiChatModel 与 OpenAiApi 标准接口，实现对 OpenAI、DeepSeek 的统一抽象与调用；支持业务方通过配置快速切换底层基座模型，模型接入效率得到大幅提升。
13. 基于 DSL 解析器与 DAG 调度算法，自主研发支持并行与串行混合编排的 Workflow 引擎，实现了 10+ 种节点类型（大模型、插件、代码、逻辑控制等）的自动化调度，支持单次执行链路长度超 50+ 节点。
14. 开发 VariablePool (变量池) 组件，通过引入 FastJSON2 进行对象的序列化与深拷贝，彻底解决多节点并发执行时的数据污染与类型转换问题， 支持复杂对象（JSON/List/Map）在节点间的精准传递与引用。
15. 在 PluginNode 中实现了基于 ReAct 范式的工具调用逻辑，支持大模型根据上下文自动决策、参数提取与 Link 插件系统的 API 调用。

## 项目经历

### 派聪明 RAG 知识库 AI应用开发 2026-01 ～ 2026-02

项目描述：派聪明是一个基于私有知识库的企业级智能对话平台，允许用户上传文档构建专属知识空间，并通过自然语言交互方式查询和获取知识。它结合了大语言模型和向量检索技术，能够让用户能够通过对话的形式与自己的知识库进行高效交互。

技术栈：SpringBoot、MySQL、Redis、Apache Tika、Ollama、Elasticsearch、MinIO、Kafka、Spring Security、WebSocket、Linux、Shell

核心职责：

- 利用 Elasticsearch + IK 分词器对知识库文档进行索引和向量检索，支持 Word、PDF 和 TXT 等多种文本类型；并集成阿里 Embedding 模型进行文本到向量的转换，支持 2048 维；再结合 ES 的 KNN 向量召回、关键词过滤和 BM25 重排序实现「关键词+语义」 的双引擎搜索。
- 编写 shell 脚本，一键启动 Kafka 的 KRaft模式，自动处理 cluster ID 的冲突问题，包括清理日志、生成集群 ID、格式化存储目录、启动 Kafka 服务器等。
- 基于 WebSocket 实现长连接（用户可主动停止），并结合 DeepSeek 大模型的 Stream API 实现流式响应返回，只要 LLM 有新的内容生成，前端就能实时接收并呈现出“打字机”式的逐字生成。
- 引入 MCP 协议对本地文件操作、PDF 生成及数据库查询等能力进行 Server 端封装，实现了Agent 与工具生态的解耦。
- 基于 Redis BitMap 管理文件分片状态（1000 个分片仅占 125 字节），结合 MinIO 实现大文件分片上传与断点续传，将 1GB 文件上传耗时由 15s 优化至 3s。
- 采用 JWT 双令牌架构（Access Token + Refresh Token），结合 ThreadLocal 管理用户上下文，实现无感刷新登录。
- 实现 Function Call 能力，通过可扩展 Tool 类封装本地方法，支持 AI 自动调用数据库检索、文件解析、第三方接口等操作；
- 基于 ReAct 架构 构建自主规划型 Agent，支持任务分解与工具链调用（网页搜索、PDF 生成等），五日行程规划任务平均生成时间 < 30 秒；
- 设计 Parent-Child Indexing 方案，将文档切分为子块用于检索，再回溯父级段落恢复上下文，解决长文档检索中语义割裂问题。
- 参考 OpenManus 开源架构，设计了分层智能体体系（BaseAgent、ReActAgent、ToolCallAgent）。利用 SpringAI  的 FunctionCallback 机制实现本地方法的自主调用，以及 ReAct 推理，赋予 Agent“思考-规划-行动-观察”的自主决策能力，使其能够处理“检索/搜索-生成文本-生成总结PDF”等跨多步骤的复杂任务。
- 编写用户认证模块单元测试，结合 JUnit + Mockito 验证 Redis 引入前后的性能差异，为系统调优提供依据。
- 基于 Kafka 解耦文件上传、处理与向量化流程，实现分片上传与断点续传；使用 Redis 的 Bitmap 存储分片状态，并通过 MinIO 按照 MD5 进行分片合并。

## 技术派社区 Java后端开发 2025-06 ～ 2025-09

项目描述：采用 5 模块分层架构，覆盖文章发布、搜索、评论、活跃排行、AI 问答、微信扫码登录、公众号消息回复等核心场景。重点负责 AI 平台能力建设与微信公众号智能运营升级。 

在线地址：paicoding.com

GitHub 仓库（已有3k+星标）：https://github.com/itwanger/paicoding

核心职责：

- 基于Redis + 动态配置实现 AI 配置管理后台，打通智谱、讯飞、DeepSeek、豆包、阿里等 9 类模型的统一配置。
- 搭建微信菜单管理能力，支持菜单草稿保存、规则校验、远程同步、正式发布、关键词匹配、订阅回复与 AI 兜底回复，解决公众号强依赖研发的问题。
- 基于 Redis + Async 异步任务 + 微信客服消息接口重构微信回调，实现 300ms 内快速 ACK、异步补发 AI 回复，并增加 30 秒回调去重锁和 600 秒响应缓存，解决大模型响应慢导致微信超时重试、消息重复处理的问题。
- 基于 ChatService 抽象层 + Prompt 注入机制增强多模型对话能力，支持 system prompt、多消息上下文和统一对话协议适配，解决不同模型请求结构不一致、上下文利用不充分的问题，支持最近 10 条历史上下文参与多轮对话。
- 接入智谱 AI 大模型，实现智能划线评论功能，类似微信中的@元宝，用户可选中任意内容，@派聪明 AI 助手进行问答，系统将自动封装划线内容+用户评论+全文作为 prompt 供 LLM 作为上下文语料，从而实现 RAG 检索增强生成。
- 独立设计并实现轻量级短链服务，支持长 URL → 短码映射，提升企业微信侧的消息点击率与用户体验；引入布隆过滤器优化短码唯一性校验。
- 采用 JWT+Redis 的双令牌机制，通过 access token 处理业务请求，refresh token 实现用户无感的令牌刷新。
- 使用 FastExcel 实现 PUPV 数据的批量导出功能，500 万条数据导出仅需 1 秒，并结合自定义线程池+ CountDownLatch 进行并发处理，导出性能提升近 60 倍。
- 接入微信的 native 支付和 H5 支付，完成微信支付的全流程，并采用双重判定的懒汉式单例设计模式和 WebSocket 双向通道完成微信支付的交互和异步实时回调通知；并通过分布式锁+幂等来防止支付记录的重复写入和更新；在支付完成后会给作者发送邮件通知，给用户发送异步消息以解锁付费内容。
- 利用 RestHighLevelClient 接入 ElasticSearch 的全文搜索能力，支持关键词高亮、模糊查询及搜索自动补全关键字，检索效率提升了 60%，同时兼容 ES 未安装时继续走 MySQL 的查询逻辑。
- 设计消息异步解耦机制，将用户的评论、点赞、收藏等衍生行为通过 RabbitMQ 异步发送至消息队列（包括通知文章作者、更新用户的活跃积分等），接口响应时间从平均 280ms 降至 50ms 内；消费者拿到消息后会从 MQ 连接池中获取连接、创建信道，然后将消息保存到 MySQL 中。
- 使用 Canal 监控 MySQL 的 binlog 变更事件，并实时同步给 ElasticSearch，将搜索延迟控制在秒级范围内。
- 在雪花算法 Snowflake 的基础上实现了一套自定义的 ID 生成方案，通过更改时间戳单位、ID 长度和 workId 与 dataCenterId 的分配比例，ID 生成的延迟降低了 20%；同时满足了社区在高并发环境下 ID 的唯一性和可追溯性。
- 采用 Redisson 看门狗策略优化缓存架构，针对热 key 的并发访问进行同步，防止其失效时导致的缓存击穿；
- 引入 Caffeine + Redis 构成多级缓冲，解决热门数据（首页流媒体、专栏教程）的吞吐量瓶颈，单节点 QPS 提升至 3000+；
- 通过 Shell 脚本实现了一套可以在 Linux 生产环境下一键源码部署的成熟方案，核心包括 Git 拉取源码、Maven 自动编译打包，nohup 启动 jar 包等，极大缓解了项目在生产环境下热部署的压力。同时也支持 Docker 容器化部署。
- 鉴于生成式的回答可能存在不可靠信息，所以借助敏感词校验开源库 sensitive-word，并结合 MyBatis 拦截器和 DFA 算法实现了一套完善的敏感词自定义过滤方案，对用户输入内容和响应内容做了自定义过滤，保证内容平台的合规性。
- 应用策略模式来支持多家 AI 大模型的灵活对接，目前已经成功集成了 Deepseek、字节豆包、阿里通义千问、腾讯混元、智谱 AI Alltools API、讯飞星火 4.0 API 和 ChatGPT 3.5 API等。
- 通过模板方法设计模式+门面类设计模式封装 DeepSeek-Chat 模型，完成派聪明 AI 聊天助手。 基于 OkHttp-SSE 完成与 DeepSeek 的Stream 流式交互，实现消息一点一点输出的动态效果。
- 接入 SpringAi 框架，对接阿里云百炼大模型，基于 Prompt 编写 Function Tool 工具类，解决 AI 返回结果结构不一致问题
- 通过 Prometheus & Grafana 在本地搭建应用监控系统，并经过 JMeter 实测，首页在 30 个线程数、10 分钟内，HTTP 请求数可达 667 req/s；1 秒内可以完成 424 次峰值响应。
- 采用 Redisson 看门狗策略优化缓存架构，针对热 key 的并发访问进行同步，防止其失效时导致的缓存击穿。

## Java 实现轻量级关系型数据库 2025.07 – 至今
项目描述：MiniDB 是一个模拟 MySQL 的轻量级数据库系统，覆盖了数据库核心机制如数据管理、事务管理、并发控制、索引构建等，旨在深入理解数据库底层运行原理和关键模块的协作关系。

核心职责：
- 设计基于 LRU 策略的页面缓存系统，结合引用计数实现脏页异步回写，并集成 WAL 日志（Redo/Undo 双日志），确保系统崩溃恢复后的 ACID 特性
- 实现基于 XID 文件的事务状态管理，设计 undo 日志与 redo 日志配合支持事务的回滚与恢复，构建符合 ACID 原则的事务框架，在异常重启后可实现故障自动恢复。
- 实现 MVCC 多版本并发控制（版本链 + Read View），支持 RC/RR 隔离级别；引入 Strict-2PL 锁协议和基于图的死锁检测算法，自动解决事务冲突
- 构建 B+ 树索引优化范围/点查询性能，自研 SQL 词法解析器与语法树执行器，支持条件过滤与连接操作
- 基于 Java NIO 完成数据文件的高效读写，降低磁盘 I/O 延迟，提升存储引擎整体性能
- 使用分页机制管理 DB 文件与 Log 文件，封装 DataItem 作为页内操作的基本单元；设计基于 LRU 策略的缓存池，提高内存命中率，减少磁盘 I/O 频率。
- 实现 RC（读已提交）与 RR（可重复读）两种隔离级别，配合 2PL 实现调度可串行化；引入版本链机制避免读写阻塞，支持 100+ 并发事务处理无阻塞。
- **死锁检测**：设计等待图并配合定时遍历实现死锁检测与事务回滚方案，避免系统卡死。
- **索引与 SQL**：基于 B+ 树实现单字段索引，支持 where 条件高效过滤及范围查询；同时实现基本 SQL（如 create、insert、select、update）语句解析器。
- 实现聚簇索引模块，基于 B+ 树构建索引结构，在 6 万条记录下索引查询耗时由原生遍历的 120ms 降至1ms。
- 在 TransactionManager 中实现基于 XID 文件的事务状态管理，结合 REDO/UNDO 日志机制及 2PC 协议，确保崩溃恢复后未提交事务可自动回滚，保障 ACID 特性；
- **索引优化**：基于 B+ 树实现非聚簇索引查询，并分别实现 Nested-Loop Join、Hash Join、Sort-Merge Join 三种连接算法。
- 设计基于 LRU 策略的页面缓存系统，引入读写锁实现线程安全；通过后台线程异步回写脏页，数据库 QPS 提升约 3 倍。

## 工作经历

### 蚂蚁集团｜后端开发｜PmHub 2024-03 ～ 至今

项目简介：开发基于 SpringCloud、SpringCloud Alibaba、Flowable 和 Vue 的智能项目管理系统。系统支持用户创建项目、指派任务、workflow 流程流转，以及分配角色进行权限管控，关联审批流，实现了项目的流程化和智能化管理。

技术栈：Spring Cloud、Spring Cloud Alibaba、Flowable、Redis、RocketMQ、TTL、Docker、SkyWalking、Seata、Sentinel、Gateway

1. 基于 Spring Cloud Gateway 实现统一鉴权逻辑与全局接口拦截，并统计接口响应耗时；本地压测峰值 QPS 达 1500+，平均接口耗时控制在 30ms 以内。
2. 自定义 Gateway 全局过滤器，实现了 Spring Cloud 微服务网关的统一鉴权（JWT 令牌校验、登录状态校验）、黑白名单过滤，并统计接口调用耗时
3. 设计实现基于 TTL 的请求头拦截器，封装用户上下文至 TransmittableThreadLocal，实现用户信息透明传递与会话续期，减少数据库查询。
4. 基于 TransmittableThreadLocal (TTL) 实现自定义请求头拦截器，将 Header 中用户数据封装到线程变量中方便获取，减少用户信息数据库查询次数，同时支持用户有效期验证与自动刷新。
5. 引入 Redis 分布式锁机制，保障任务审批流程中状态修改的原子性与顺序性，解决并发更新引起的状态错乱问题。
6. 基于 Redis 的 Redisson 分布式锁，结合自定义注解和 AOP，精准控制并发，确保流程状态按序更新，审批设置全局唯一锁定。
7. 采用 Seata 分布式事务 AT 模式，确保新建任务与审批流程操作在分布式环境下的事务一致性。
8. 接入 Redis 分布式锁控制任务审批流程状态更新，避免并发修改带来的顺序错乱。
9. 通过 OpenFeign+Sentinel 实现自定义的 fallback 服务降级，确保系统在异常情况下仍能稳定运行；结合 Gateway+Sentinel 进行网关级限流，有效缓解峰值流量对单点服务的冲击。在 长时间高并发压测（2 小时，1700QPS）下，服务表现稳定，平均响应时间低于 60ms，可用性稳定保持在 99.9% 以上。
10. 使用 OpenFeign + Sentinel 实现核心服务调用熔断与自动降级，在依赖异常时能够给用户一个友好的反馈机制；
11. 配置 Nacos 作为服务注册与配置中心，通过 MySQL 持久化 Nacos 配置数据，规避重启造成的配置丢失问题。
12. 在 Gateway 网关配置路由，并通过自定义过滤器实现 JWT 鉴权，并自定义拦截器在微服务间传递用户令牌信息。
13. 使用 Flowable 构建项目和任务的审批流程，引入 Redis 分布式锁，确保流程节点状态更新的顺序；将审批事件通过 RocketMQ 异步投递，提高流程处理吞吐量。
14. 引入 SkyWalking 实现分布式调用链监控；集成校园邮件网关，实现流程审批结果的邮件通知，用户平均响应时间优化至 200ms 以内。


## 专业技能

- 掌握 Spring AI、LangChain4j 等 AI Agent 应用框架，能够基于 Function Calling  接入企业内部 API、数据库等业务系统，了解 MCP 协议及多步任务编排方案。
- 熟悉 RAG，能够完成文档解析、切块、Embedding、Prompt 上下文拼接；能够利用 Elasticsearch 实现混合检索，并通过相似度阈值、Top-K 与 Rerank 优化召回效果，降低模型幻觉。
- 熟悉 Linux 系统（SUSE、Euler、CentOS等）及Windows Server的安装部署、运维管理和性能优化，具备生产环境系统调优经验；熟练使用Linux文本处理工具（awk、sed、grep），能够快速分析系统及业务日志。
- 掌握 Java 基础知识，如集合框架、IO流、Stream流、反射机制等，阅读过 HashMap 源码，了解其扩容机制；熟悉 Java 开发中常见的设计模式，如工厂模式、代理模式、单例模式等。
- 熟悉计算机网络常见协议，例如 HTTP、HTTPS、TCP、UDP、IP、DNS 网络协议；熟悉 TCP 三次握手、四次挥手以及 TLS 的四次握手的过程。
- 熟练使用各种 AI Coding 工具，如 Codex、Claude Code、Cursor、Copilot 等工具辅助需求分析、代码实现、调试排错与文档整理，具备较强的人机协同开发能力。