# 输出模板

根据用户选择的分析模式输出不同的产物：

- **浅层分析** → 输出 `project-guide/project-guide.md`（Markdown 报告）
- **深层分析 Phase 1** → 输出项目骨架卡片（即时，10-30 秒）
- **深层分析 Phase 2** → 用户选择深层分析后继续执行，输出 `project-guide/` 目录（交互式 HTML 指南，约 18 个文件）
- **聚焦分析** → 输出 `project-guide/{模块名}-focus.md` 或 `.html`（指定模块的深入剖析）

## Phase 1 骨架输出模板（深层分析即时扫描产物）

```markdown
## 🏷️ 项目骨架 — {项目名称}

| 属性 | 值 |
| --- | --- |
| 名称 | {从 package.json/README 提取} |
| 类型 | {前端/后端/全栈/CLI/...} |
| 规模 | {🟢🟡🔴⚫} · ~{文件数} 文件 |
| 入口 | `{入口文件}` → `{路由/主模块}` |
| 启动 | `{dev命令}` → {端口/URL} |
| 构建 | `{build命令}` → `{输出目录}` |

### 🛠️ 技术栈
{技术标签云，每个标签标注证据文件。按类别分组：语言/框架/构建/数据库/...}

### 📁 顶层结构
{顶层目录 + 说明（不超过 10 行，每个目录标注 P0/P1/P2 优先级）}

### 🧩 发现的业务领域
（从路由/服务/状态/目录名推断，列出概念名 + 关键文件）
1. {领域A} — {关键文件路径}
2. {领域B} — {关键文件路径}
...

### ⚠ 风险标志
- {未找到 .env.example → 新人需手动配置环境变量}
- {发现循环依赖：A ↔ B}
- {无测试目录}
（仅列出"阻碍项目正常启动"级别的风险，不做代码改进建议）

---
🕐 以上扫描耗时约 {N} 秒。

下一步将生成完整 HTML 项目指南，预计 {N} 分钟。
如需改为聚焦特定模块，请直接说「聚焦 {模块名}」。
```

## 浅层分析模板 → `project-guide/project-guide.md`

```markdown
# 项目：[名称]

## 证据摘要

- 已查看文件：
- 已运行命令：
- 运行验证：
- 未验证/阻塞：
- 抽样策略：

## 1. 项目概览

- 定位：
- 目标用户：
- 核心价值：
- 当前成熟度：

## 2. 技术栈

| 类别 | 技术 | 证据 |
| --- | --- | --- |

## 3. 目录和关键文件

| 路径 | 作用 | 备注 |
| --- | --- | --- |

## 4. 项目结构树

```text
项目根
├── src/                        # ★ P0 核心源代码
│   ├── main.ts                 # ★ P0 应用入口 — 初始化 Vue 实例和全局插件
│   ├── App.vue                 # ★ P0 根组件 — 包含 layout 和路由出口
│   ├── router/index.ts         # ★ P0 路由定义 — 所有页面路由配置
│   ├── pages/                  # ● P1 页面组件
│   │   ├── Home/               #     首页模块
│   │   ├── Login/              #     登录模块
│   │   └── Dashboard/          #     数据看板
│   ├── components/             # ● P1 通用组件
│   ├── services/               # ● P1 API 服务层 — 12 个 service 文件
│   ├── store/                  # ● P1 Pinia 状态管理
│   ├── hooks/                  # ● P1 自定义 Hook — 8 个 hook
│   ├── utils/                  # ● P2 工具函数
│   └── types/                  # ● P2 TypeScript 类型定义
├── config/                     # ▲ P1 Vite/ESLint/环境配置
├── public/                     # ● P2 静态资源
├── tests/                      # ● P2 测试文件
└── package.json                # ▲ P0 依赖和脚本清单
```

### 依赖方向

```text
页面层 → 组件/Hook层 → 服务/状态层 → 工具/类型层
```

## 5. 启动和运行路径

- 安装：
- 开发启动：
- 构建：
- 测试：
- 端口/进程：
- 常见失败点：

## 6. 架构

必要时附 Mermaid 或 ASCII 图。

## 7. 主数据/控制流

逐步说明核心链路。

## 8. 核心模块

| 模块 | 职责 | 调用方 | 依赖 | 风险 |
| --- | --- | --- | --- | --- |

### 代码文件摘要（示例）

#### `src/services/userService.ts`

- **职责**：用户相关 API 调用（登录、注册、信息查询、更新）
- **核心导出**：`login()`, `register()`, `getUserInfo()`, `updateProfile()`
- **依赖**：`src/utils/request.ts`（HTTP 实例）, `src/types/user.ts`（类型）
- **被依赖**：`LoginPage`, `ProfilePage`, `UserMenu` 等 8 个组件
- **⚠ 注意**：`login()` 同时设置 cookie 和 store，token 刷新在拦截器中

## 9. 状态和契约

- 配置：
- 运行时状态：
- 持久化状态：
- 请求/响应契约：
- 重要 ID/key：

## 10. 外部依赖

| 依赖 | 用途 | 配置 | 失败模式 | 验证方式 |
| --- | --- | --- | --- | --- |

## 11. 埋点事件清单

| 事件名 | 类别 | 触发时机 | 所在文件 | 参数 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `page_view` | 页面浏览 | 路由切换 | `router/index.ts:45` | page_name | ✅ |
| `search_query` | 用户行为 | 搜索提交 | `pages/Search.tsx:89` | keyword, count | ✅ |
| `api_error` | 错误事件 | API 失败 | `utils/request.ts:67` | url, status | ✅ |

### 埋点覆盖缺口

| 流程 | 应有埋点 | 现状 | 建议 |
| --- | --- | --- | --- |
| 注册流程 | 每步转化率 | 仅有成功上报 | 增加中间步骤 |

## 12. 开发工作流和约定

- 文件组织：
- 命名：
- service/API：
- 状态：
- 样式：
- 权限：

## 13. 测试和验证

- 已有测试：
- 已运行：
- 未运行：
- 建议验证路径：

## 14. 风险和开放问题

| 风险/问题 | 证据 | 影响 | 下一步 |
| --- | --- | --- | --- |

## 15. 推荐下一步

- 短期：
- 中期：
- 长期：

## 16. 快速导航

### 按模块
- [用户认证] — LoginPage, AuthService, userStore
- [数据看板] — DashboardPage, ChartService, useChartData
- [系统设置] — SettingsPage, ConfigService

### 按文件类型
- [入口文件] — main.ts, App.tsx, router.ts
- [API 服务] — 12 个 service 文件
- [通用组件] — 25 个通用组件
- [工具函数] — 18 个工具模块

### 常用命令
- `npm run dev` — 启动开发服务器
- `npm run build` — 生产构建
- `npm run test` — 运行测试
- `npm run lint` — 代码检查

## 17. 新人阅读路径

1. ...
2. ...
3. ...
```

## 聚焦分析模板

```markdown
# {模块名} — 聚焦分析报告

## 1. 模块定位

- **所属项目**：
- **模块名称**：
- **核心职责**：（一句话：这个模块解决什么问题）
- **边界定义**：（哪些文件属于本模块）

## 2. 文件清单

| 文件 | 职责 | 优先级 | 行数 |
| --- | --- | --- | --- |
| `src/modules/auth/LoginPage.tsx` | 登录页面组件 | P0 | ~150 |
| `src/modules/auth/AuthService.ts` | 认证服务层 | P0 | ~200 |
| ... | ... | ... | ... |

## 3. 模块内部结构

（ASCII 目录树 + 文件间引用关系图）

```text
src/modules/auth/
├── LoginPage.tsx         ★ P0 登录页面入口
├── RegisterPage.tsx      ● P1 注册页面
├── AuthService.ts        ★ P0 认证服务（核心）
├── useAuth.ts            ● P1 认证状态 Hook
├── AuthGuard.tsx         ● P1 路由守卫组件
└── types.ts              ● P2 类型定义
```

## 4. 外部依赖关系

**本模块依赖（导入的外部模块）：**
| 外部模块 | 用途 | 被哪些文件引用 |
| --- | --- | --- |
| `src/utils/request.ts` | HTTP 实例 | AuthService.ts |
| `src/store/userStore.ts` | 用户状态 | useAuth.ts, LoginPage.tsx |

**被外部模块依赖（被谁导入）：**
| 外部模块 | 使用了什么 | 影响程度 |
| --- | --- | --- |
| `src/router/index.ts` | AuthGuard | 高（所有路由都依赖守卫） |
| `src/components/UserMenu.tsx` | useAuth | 中 |

## 5. 逐文件代码分析

### `AuthService.ts`

> （按聚焦分析标准：完整职责、核心导出、关键代码片段 + 逐行分析、内部依赖、被依赖方、风险点）

### `LoginPage.tsx`

> （同上）

### ...

## 6. 模块数据流追踪

（Mermaid 时序图 + 关键步骤说明）

## 7. 模块埋点清单

| 事件名 | 类别 | 所在文件:行 | 参数 | 状态 |
| --- | --- | --- | --- | --- |

## 8. 风险和技术债

| 风险 | 位置 | 影响 | 建议 |
| --- | --- | --- | --- |

## 9. 修改影响范围评估

| 变更类型 | 影响的外部文件 | 风险等级 | 建议 |
| --- | --- | --- | --- |
| 修改 AuthService 接口 | 4 个页面 + 2 个 Hook | 中 | 先加类型测试 |
| 修改 token 存储方式 | 整个应用的认证链路 | 高 | 需要全链路回归 |

## 10. 推荐下一步

- 短期：
- 中期：
```

## HTML 项目指南（深层分析产物）

深层分析 Phase 2 生成一个模块化的 **`project-guide/` 目录**。核心采用 **Section 注册表模式**：每个分析章节是独立文件，通过统一接口注册到核心框架。新增分析维度只需添加 section 文件 + 数据字段 + 一行 `<script>`。

### 目录结构

```text
{目标项目根目录}/
└── project-guide/
    ├── index.html                  # 入口文件（薄壳，~50 行）
    ├── css/
    │   └── guide.css               # 所有样式（按节分区，含完整注释）
    ├── js/
    │   ├── guide-core.js           # 核心框架：Section 注册表 + UI 工具
    │   ├── guide-data.js           # 项目分析数据（单一数据源）
    │   └── sections/               # Section 渲染器（可独立增删）
    │       ├── overview.js         # 1. 项目概览
    │       ├── quickstart.js       # 2. 快速开始
    │       ├── structure.js        # 3. 项目结构树
	    │       ├── concept-map.js      # 4. 概念地图 🧭（业务概念→代码位置）
    │       ├── architecture.js     # 5. 架构概览
    │       ├── code-analysis.js    # 6. 代码展示与分析 ⭐（深层核心）
    │       ├── modules.js          # 7. 核心模块详解
    │       ├── dataflow.js         # 8. 数据流追踪
    │       ├── tracking.js         # 9. 埋点事件清单
    │       ├── workflow.js         # 10. 开发工作流
    │       ├── roadmap.js          # 11. 新人阅读路线
    │       ├── risks.js            # 12. 风险和注意事项
    │       └── appendix.js         # 13. 附录
    └── extensions/
        └── README.md               # 扩展开发指南
```

### HTML 包含内容

| 章节 | 内容 | 对应 Section |
| --- | --- | --- |
| 项目概览 | 名称、描述、技术栈标签云 | `overview.js` |
| 快速开始 | 环境要求、命令 + 一键复制 | `quickstart.js` |
| 项目结构树 | 带注释的完整目录树 + 依赖方向 | `structure.js` |
| 概念地图 🧭 | 业务概念→代码位置映射 + Mermaid 关系图 + 详情卡片 | `concept-map.js` |
| 架构概览 | 系统架构 Mermaid 图 + 分层说明 | `architecture.js` |
| 代码展示与分析 ⭐ | 关键业务代码 + 逐行分析注释 | `code-analysis.js` |
| 核心模块详解 | 每个模块的职责和接口 | `modules.js` |
| 数据流追踪 | 关键流程 Mermaid 时序图 | `dataflow.js` |
| 埋点事件清单 | 全部埋点 + 覆盖缺口 | `tracking.js` |
| 开发工作流 | 分支策略、规范、Review 流程 | `workflow.js` |
| 新人阅读路线 | 按角色推荐阅读顺序 | `roadmap.js` |
| 风险和注意事项 | 已知风险、缓解建议 | `risks.js` |
| 附录 | 命令速查、环境变量、名词解释 | `appendix.js` |

### HTML 功能要求

- Section 注册表模式（`ProjectGuide.registerSection()`）：添加/删除章节无需改动核心
- 左侧固定导航栏，自动从已注册 section 构建
- 实时全文搜索（模块、文件、函数、埋点、代码）
- 暗色/亮色主题切换（偏好存储在 localStorage，首次跟随系统）
- 响应式设计（桌面/平板/手机，移动端汉堡菜单）
- 交互式目录树（展开/折叠/全部展开/全部折叠）
- 代码展示面板：文件路径 + 代码 + 逐行分析 + 一键复制
- 导航跟随滚动高亮（Intersection Observer）
- 键盘快捷键（`Ctrl+K` 搜索、`Ctrl+/` 侧边栏、`Esc` 关闭）
- 所有 JS 通过 `<script src>` 加载，兼容 `file://` 协议

### 生成步骤

1. 完成项目分析，收集所有数据
2. 创建目录结构：
   ```bash
   mkdir -p project-guide/css
   mkdir -p project-guide/js/sections
   mkdir -p project-guide/extensions
   ```
3. 使用 `references/html-guide-template.md` 中的各文件模板
4. 按顺序写入文件（共约 17 个）：
   - 模板文件直接复制：`guide.css`、`guide-core.js`、`index.html`、`extensions/README.md`
   - 根据分析结果填充：`guide-data.js`（集中管理所有数据）
   - 按项目实际情况调整：`js/sections/*.js`（有数据的 section 保留，无数据的可删除对应 `<script>` 标签）
5. 告知用户文件路径，建议用浏览器打开 `project-guide/index.html`
