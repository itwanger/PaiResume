# PaiResume

PaiResume 是一个面向中文简历场景的在线简历编辑器，采用前后端分离架构，支持账号体系、模块化简历编辑、实时预览、Markdown/TXT 简历导入、AI 优化与整份简历分析，以及 PDF 导出。

## 项目特性

- 邮箱注册、登录、Token 刷新与退出登录
- 简历列表管理：新建、重命名、删除
- 模块化简历编辑：基础信息、教育背景、实习经历、项目经历、专业技能、论文发表、科研经历、获奖情况
- 实时预览，编辑区与预览区联动
- 支持拖拽导入 Markdown / TXT 格式的结构化简历
- 支持 AI 单模块优化
- 支持整份简历分析与评分，支持自定义分析提示词
- 支持导出 PDF
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
├── .env.example                  # 前端环境变量示例
└── server/.env.example           # 后端环境变量示例
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

进入后端目录：

```bash
cd server
cp .env.example .env
```

按实际情况修改 `server/.env`，至少确认以下配置：

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
mvn spring-boot:run
```

默认情况下：

- 后端地址：[http://localhost:8084/api](http://localhost:8084/api)
- 健康检查：[http://localhost:8084/api/health](http://localhost:8084/api/health)
- 就绪检查：[http://localhost:8084/api/ready](http://localhost:8084/api/ready)
- 接口文档：[http://localhost:8084/api/doc.html](http://localhost:8084/api/doc.html)

说明：

- 后端启动时会自动执行 `server/src/main/resources/schema.sql` 建表。
- 当前项目没有显式依赖 Flyway 运行迁移，数据库初始化以 `schema.sql` 为准。
- 在 `APP_ENV` 不是 `development` 时，必须显式覆盖 `JWT_SECRET`，否则服务会拒绝启动。

### 3. 启动前端

在项目根目录执行：

```bash
cp .env.example .env
npm install
npm run dev
```

默认情况下：

- 前端地址：[http://localhost:5173](http://localhost:5173)
- 前端会通过 Vite 代理把 `/api` 请求转发到后端

## 环境变量

### 前端 `.env`

| 变量名 | 说明 | 默认/示例 |
| --- | --- | --- |
| `VITE_REACT_APP_TITLE` | 页面标题 | `派简历` |
| `VITE_PORT` | 前端端口 | `5173` |
| `VITE_API_BASE_URL` | 前端请求基础路径 | `/api` |
| `VITE_API_PROXY_TARGET` | 本地代理目标地址 | `http://localhost:8084` |
| `VITE_AI_API_KEY` | 预留的前端 AI Key | 可选 |
| `VITE_AI_BASE_URL` | 预留的前端 AI Base URL | 可选 |
| `VITE_AI_MODEL` | 预留的前端 AI 模型名 | 可选 |

说明：

- 当前简历分析与模块优化的主流程由后端 AI 接口提供。
- 前端中的 AI 环境变量更多是兼容性保留配置，联调时优先保证后端 AI 配置正确。

### 后端 `server/.env`

| 变量名 | 说明 |
| --- | --- |
| `APP_ENV` | 运行环境，默认 `development` |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | 允许跨域来源 |
| `SERVER_PORT` | 后端端口，默认 `8084` |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USERNAME` / `MYSQL_PASSWORD` | MySQL 连接配置 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接配置 |
| `JWT_SECRET` | JWT 密钥，生产环境必须替换 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` / `AI_ANALYSIS_MODEL` | AI 服务配置 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | 邮件配置 |

## 当前功能说明

### 认证

- 注册时需要邮箱验证码
- 登录后前端会持久化 `accessToken` 与 `refreshToken`
- 遇到 401/部分 403 场景时，前端会自动尝试刷新 Token

注意：

- 当前验证码发送逻辑还没有真正接入 SMTP 发送，后端会把验证码打印到日志中用于本地联调。

### 简历编辑

- 在工作台创建简历后进入编辑页
- 左侧为模块导航，中间为模块表单，右侧为实时预览
- 支持同类模块多实例的有：实习经历、项目经历、论文发表、科研经历、获奖情况等
- 支持对单个模块发起 AI 优化
- 支持对整份简历执行 AI 分析

### 导入与导出

- 当前已启用：Markdown / TXT 导入
- 当前未启用：Word 导入、PDF 导入
- 已支持 PDF 导出，导出文件名会尽量根据姓名、学校、求职意向生成

## 主要接口

### 认证接口

- `POST /api/auth/register`
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

### AI 接口

- `POST /api/resumes/{resumeId}/modules/{moduleId}/ai-optimize`
- `POST /api/resumes/{resumeId}/analysis`

## 开发建议

- 建议先启动 MySQL 和 Redis，再启动后端，最后启动前端
- 如果前端请求异常，先确认 `VITE_API_PROXY_TARGET` 与后端端口是否一致
- 如果注册拿不到验证码，直接查看后端控制台日志
- 如果 AI 分析失败，优先检查后端 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`
- 如果 PDF 导出异常，确认 `public/fonts/` 下的字体文件存在

## 后续可扩展方向

- 接入真实邮件发送能力
- 开放 Word / PDF 简历导入
- 增加更多模板与排版主题
- 增加简历分享、公开链接和多模板导出
- 增加部署脚本、Docker 化与 CI/CD
