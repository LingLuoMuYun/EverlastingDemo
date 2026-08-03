# 项目形态专项分析

针对不同项目形态的专项分析指南。分析时根据项目形态加载对应章节。

---

## 前端项目

适用于 React、Vue、Angular、Next.js、Nuxt、Vite、Electron renderer 或后台管理系统。

### 关键问题

- 使用什么框架和路由？应用根在哪里？
- layout、错误页、路由守卫在哪里？
- API client 定义在哪里？全局状态存在哪里？
- 认证和权限如何处理（路由/菜单/按钮/API）？
- 环境变量如何加载？样式如何组织？
- 上传和下载如何处理？

### 核心流程

```
用户交互 → 路由/页面 → 组件/hook → service/API client
→ HTTP 请求 → 响应解析 → 状态更新 → UI 渲染
```

### 环境识别

- 开发服务器端口、后端/API base URL、proxy/rewrite 配置
- CORS 假设、构建输出目录、asset/CDN 前缀
- WebSocket 端点、本地必需的后端服务

### 常见失败模式

- 前端指向错误的后端地址
- 环境变量只在构建时可用、API 前缀重复或缺失
- 认证 token 缺失或过期、权限缓存过期
- SSR/客户端边界因 `window`/`localStorage` 破裂
- 构建跳过 lint 或类型检查

### 推荐验证

`typecheck → lint → test → build → 手动登录冒烟 → 浏览器控制台检查`

---

## 后端项目

适用于后端服务、API 项目、微服务、数据处理服务。

### 关键问题

- 语言/Web 框架？服务入口在哪里？
- 路由如何组织和注册？中间件链顺序？
- 数据库/缓存/消息队列如何连接？
- 认证和授权方案是什么？
- 配置如何加载？日志/监控/链路追踪？
- 有没有定时任务、后台 worker、消息消费者？

### 核心流程

```
HTTP 请求 → 网关/LB → 中间件链(认证→限流→日志→校验)
→ 路由匹配 → Controller → Service → Repository
→ 数据库/缓存/外部API → 响应序列化 → HTTP 响应
```

### 入口点速查

| 类型 | 常见位置 |
| --- | --- |
| HTTP 入口 | `main.*`, `app.*`, `server.*`, `cmd/` |
| 路由 | `router/**`, `handler/**`, `controller/**` |
| 中间件 | `middleware/**`, `filter/**`, `interceptor/**` |
| 数据库 | `db.*`, `models/**`, `entity/**`, `migrations/**` |
| 服务层 | `services/**`, `usecase/**`, `domain/**` |
| 定时任务 | `cron/**`, `jobs/**`, `tasks/**` |
| 消息消费 | `consumer/**`, `listener/**` |

### 架构分层

```
Transport Layer (HTTP/gRPC) → Application/Service → Domain → Infrastructure (DB/Cache/MQ/外部API)
```

检查：是否存在跨层依赖？数据访问是否统一封装？

### 常见失败模式

- 数据库连接池耗尽、缓存雪崩
- 消息重复消费导致数据不一致
- 外部 API 超时拖垮请求链
- 配置热更新不生效、未处理 panic 导致进程退出
- 优雅关闭未实现、时区不一致、大事务锁等待

### 安全审查要点

- 认证机制：JWT/Session/OAuth2/API Key
- 授权粒度：接口级/数据级/字段级
- 输入校验、SQL 注入防护、敏感数据脱敏
- 限流/CC 防护、CORS/CSRF 配置

---

## Monorepo 项目

适用于 Turborepo / Nx / Lerna / pnpm workspaces / Yarn workspaces。

### 盘点步骤

1. **识别工具**：检查 `pnpm-workspace.yaml` / `lerna.json` / `nx.json` / `turbo.json` / `rush.json`
2. **子项目清单**：每个子项目登记名称、路径、类型、职责、技术栈、兄弟包依赖
3. **依赖关系图**：绘制子项目间的依赖方向
4. **共享代码分析**：是否被合理使用？是否有独立测试和文档？版本是否锁定？

### 子项目分析策略

1. 将每个子项目视为独立项目，执行完整分析流程
2. 共享包单独分析，关注其 API 和版本
3. 交叉引用：依赖方和被依赖方
4. 合并为统一总览 + 各子项目详情

### 构建和版本

- Turborepo：`turbo.json` pipeline / dependsOn / 缓存策略
- Nx：`nx.json` 任务编排 / 依赖图
- pnpm：`--filter` 过滤执行
- 版本管理：固定版本 vs 独立版本？Changesets？

### 常见失败模式

- 共享包修改后忘记重新构建
- 循环依赖、子项目间 API 契约不明确
- CI 全量构建耗时过长
- 共享包中混入业务逻辑
- 环境变量在子项目间泄漏或混淆

### HTML 指南特殊处理

- 结构树统一展示，子项目作为一级节点
- 每个子项目独立章节（概览、结构、模块、埋点）
- 共享包在导航中单独分组

---

## 安全审查

用于认证、授权、密钥处理、依赖风险或审计导向的项目分析。

### 首要问题

- 哪些用户/角色/资源/凭据需要保护？
- 信任边界在哪里被跨越？
- 用户/服务如何认证？授权如何执行？
- 密钥在哪里加载、存储、记录、脱敏？
- 哪些输入是不可信的？

### 需定位的位置

- auth middleware、路由守卫、session/token 处理
- 角色/权限/菜单/按钮检查
- 上传处理、解析器、序列化器、校验器
- 配置加载和环境模板
- 日志/遥测/错误上报中是否有敏感数据
- 外部 API client 和回调
- 依赖 manifest、lockfile、CI、部署脚本

### 风险区域

- guard 覆盖缺失导致认证绕过
- 对象级授权缺口
- 密钥被提交、回显或记录
- 不安全文件路径、压缩包解压、shell 执行、反序列化
- 开放重定向、CORS 过宽、CSRF 缺口、不安全 cookie
- 依赖混淆、可变 action/image tag、未固定版本
- 破坏性操作缺少审计日志

### 安全规则

- 不输出密钥、私钥、token、完整连接串、敏感记录
- 优先防御性检查和验证，不执行利用
- 安全结论标记：已确认 / 很可能 / 可能 / 待确认
