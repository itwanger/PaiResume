# 基本信息

姓名：沉默王二
求职意向：AI应用开发工程师
邮箱：qing_gee@163.com
GitHub：https://github.com/itwanger/  
博客：https://javabetter.cn  
籍贯：河南

## 教育背景

### 郑州大学

- 学历：本科
- 时间：2023年9月 - 2027年6月
- 院系：计算机
- 专业：计算机科学与技术
- 标签：211
- 奖项：国家励志奖学金（2024年）

## 实习经历

### 淘宝闪购｜AI应用｜PaiAgent

项目简介：基于 LangGraph4j + Spring AI 的企业级 AI 工作流平台，支持通过可视化拖拽界面编排多种大模型和工具节点，使用状态图引擎执行复杂 AI 任务。

技术栈：Java 21、Spring Boot 3.4、Spring AI 1.0、LangGraph4j 1.8、React 18、ReactFlow

1. 基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。
2. 设计 ChatClientFactory 动态工厂，运行时根据节点配置动态创建 OpenAI 兼容的 ChatClient，实现 OpenAI、DeepSeek、通义千问等多厂商 LLM 无缝切换。
3. 使用模板方法模式重构 5 个 LLM 节点执行器，抽象 AbstractLLMNodeExecutor 基类，子类仅需实现 getNodeType()，代码量从 800+ 行精简至每个 10 行。
4. 实现 Skill 预置知识包机制，支持 SkillRegistry 自动加载、Reference 缓存、全量/渐进式两种注入模式。
5. 实现 TTS 语音合成节点，支持 UTF-8 字节级文本分段、标点断句、并行合成、WAV 格式合并。

## 项目经历

## 写法1 派聪明 RAG 知识库 Java 后端开发 2025-06 ～ 2025-09

项目描述：派聪明是一个基于私有知识库的企业级智能对话平台，允许用户上传文档构建专属知识空间，并通过自然语言交互方式查询和获取知识。它结合了大语言模型和向量检索技术，能够让用户能够通过对话的形式与自己的知识库进行高效交互。

技术栈：SpringBoot、MySQL、Redis、Apache Tika、Ollama、Elasticsearch、MinIO、Kafka、Spring Security、WebSocket、Linux、Shell

核心职责：

- 编写 shell 脚本，一键启动 Kafka 的 KRaft模式，自动处理 cluster ID 的冲突问题，包括清理日志、生成集群 ID、格式化存储目录、启动 Kafka 服务器等。
- 引入 MCP 协议对本地文件操作、PDF 生成及数据库查询等能力进行 Server 端封装，实现了Agent 与工具生态的解耦。
- 参考 OpenManus 开源架构，设计了分层智能体体系（BaseAgent、ReActAgent、ToolCallAgent）。利用 SpringAI  的 FunctionCallback 机制实现本地方法的自主调用，以及 ReAct 推理，赋予 Agent“思考-规划-行动-观察”的自主决策能力，使其能够处理“检索/搜索-生成文本-生成总结PDF”等跨多步骤的复杂任务。
- 编写用户认证模块单元测试，结合 JUnit + Mockito 验证 Redis 引入前后的性能差异，为系统调优提供依据。
- 基于 Kafka 解耦文件上传、处理与向量化流程，实现分片上传与断点续传；使用 Redis 的 Bitmap 存储分片状态，并通过 MinIO 按照 MD5 进行分片合并。

## 专业技能

- 了解 RAG 流程，能完成文档解析、分段切块、向量化、混合检索和上下文拼接，并处理相似度阈值与召回数量等参数调优。
- 掌握 Embedding 向量化与向量检索，使用 ElasticSearch dense_vector 或其他向量库进行相似度检索，并结合 BM25 实现混合搜索提升召回质量。
- 深入理解 Agent / Function Calling 等机制，能通过工具调用把模型能力接入业务系统，比如查询数据库、检索知识库、调用内部接口，并处理工具返回的结构化结果。
- 熟悉Linux系统（SUSE、Euler、CentOS等）及Windows Server的安装部署、运维管理和性能优化，具备生产环境系统调优经验；熟练使用Linux文本处理工具（awk、sed、grep），能够快速分析系统及业务日志
- 掌握Java基础知识，如集合框架、VO流、Stream流、反射机制等，阅读过HashMap源码，了解其扩容机制;熟悉Java开发中常见的设计模式，如工厂模式、代理模式、单例模式等。
- 熟悉计算机网络常见协议，例如HTTP、HTTPS、TCP、UDP、IP、DNS等网络协议;熟悉TCP三次握手、四次挥手以及TLS的四次握手的过程。