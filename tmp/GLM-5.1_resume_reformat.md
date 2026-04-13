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

### 淘宝闪购｜AI应用｜PaiAgent

项目简介：基于 LangGraph4j + Spring AI 的企业级 AI 工作流平台，支持通过可视化拖拽界面编排多种大模型和工具节点，使用状态图引擎执行复杂 AI 任务。

技术栈：Java 21、Spring Boot 3.4、Spring AI 1.0、LangGraph4j 1.8、React 18、ReactFlow

1. 基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。
2. 设计 ChatClientFactory 动态工厂，运行时根据节点配置动态创建 OpenAI 兼容的 ChatClient，实现 OpenAI、DeepSeek、通义千问等多厂商 LLM 无缝切换。
3. 使用模板方法模式重构 5 个 LLM 节点执行器，抽象 AbstractLLMNodeExecutor 基类，子类仅需实现 getNodeType()，代码量从 800+ 行精简至每个 10 行。
4. 实现 Skill 预置知识包机制，支持 SkillRegistry 自动加载、Reference 缓存、全量/渐进式两种注入模式。
5. 实现 DAG 工作流解析引擎，基于 Kahn 算法的拓扑排序确定节点执行顺序，DFS 深度优先搜索检测循环依赖防止死锁，支持一对多、多对一的节点连接方式
5. 实现 Prompt 支持模板变量替换，可通过 {{variable}} 解析 input 静态值和 reference 动态引用两种参数类型，支持从上游节点输出中自动获取参数值，实现节点间数据流的灵活映射
5. 实现 TTS 语音合成节点，支持 UTF-8 字节级文本分段、标点断句、并行合成、WAV 格式合并。
6. 编写并优化 Docker Compose 编排脚本 ，统一管理 MySQL、Redis、MinIO、Console Hub 及 Workflow Engine 等 5+ 个核心服务的依赖关系与健康检查，实现了“一键拉起”开发环境，将本地环境搭建时间从小时级降低至 30 分钟以内。
7. 设计了 LlmChatHistory 组件，支持动态组装 SystemMessage 、 UserMessage 与 AssistantMessage ；并基于 Token 滑动窗口实现了历史记录截断策略，在有限的 Context Window 内最大化保留对话上下文，有效解决长对话场景下的 Token 溢出问题。

## 项目经历

## 派聪明 RAG 知识库 Java 后端开发 2025-07 ～ 2025-09

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

## 技术派

## 专业技能

- 掌握 Spring AI、LangChain4j 等 AI Agent 应用框架，能够基于 Function Calling  接入企业内部 API、数据库等业务系统，了解 MCP 协议及多步任务编排方案。
- 熟悉 RAG，能够完成文档解析、切块、Embedding、Prompt 上下文拼接；能够利用 Elasticsearch 实现混合检索，并通过相似度阈值、Top-K 与 Rerank 优化召回效果，降低模型幻觉。
- 熟悉 Linux 系统（SUSE、Euler、CentOS等）及Windows Server的安装部署、运维管理和性能优化，具备生产环境系统调优经验；熟练使用Linux文本处理工具（awk、sed、grep），能够快速分析系统及业务日志。
- 掌握 Java 基础知识，如集合框架、IO流、Stream流、反射机制等，阅读过 HashMap 源码，了解其扩容机制；熟悉 Java 开发中常见的设计模式，如工厂模式、代理模式、单例模式等。
- 熟悉计算机网络常见协议，例如 HTTP、HTTPS、TCP、UDP、IP、DNS 网络协议；熟悉 TCP 三次握手、四次挥手以及 TLS 的四次握手的过程。
- 熟练使用各种 AI Coding 工具，如 Codex、Claude Code、Cursor、Copilot 等工具辅助需求分析、代码实现、调试排错与文档整理，具备较强的人机协同开发能力。