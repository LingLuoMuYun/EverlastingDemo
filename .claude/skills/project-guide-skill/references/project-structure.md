# 项目结构树分析

用于系统化地梳理项目目录结构和代码文件内容，生成带注释的目录树和关键文件摘要。

## 目录树生成规范

### 分组规则

将目录按职责分组，使用注释标注：

```
项目根目录
├── src/                        # 核心源代码
│   ├── components/             # 通用组件
│   ├── pages/                  # 页面/路由入口
│   ├── services/               # API 调用层
│   ├── hooks/                  # 自定义 Hook
│   ├── store/                  # 状态管理
│   ├── utils/                  # 工具函数
│   └── types/                  # 类型定义
├── config/                     # 构建和运行配置
├── public/                     # 静态资源
├── tests/                      # 测试文件
├── scripts/                    # 构建/部署脚本
├── docs/                       # 项目文档
└── .gitignore                  # Git 忽略规则
```

### 标注规则

- **★** — 入口文件（应用根、路由定义、启动脚本）
- **●** — 核心业务模块（高频修改区域）
- **▲** — 配置和环境相关（需要根据环境调整）
- **⚠** — 容易出问题的文件（复杂逻辑、历史包袱）
- **[跳过]** — 生成产物、vendor、缓存、构建输出

### 优先级标记

每个目录/文件标注优先级：
- **P0（必读）** — 不读就无法理解项目运行
- **P1（重要）** — 核心流程涉及的文件
- **P2（参考）** — 按需查阅
- **P3（可跳过）** — 除非特定需求否则不需要看

## 代码文件内容分析

### 文件摘要模板

对每个关键文件生成以下摘要卡片：

```markdown
### `src/services/userService.ts`

- **职责**：用户相关的 API 调用封装，包括登录、注册、信息查询
- **核心导出**：`login()`, `register()`, `getUserInfo()`, `updateProfile()`
- **依赖**：
  - `src/utils/request.ts` — HTTP 请求实例
  - `src/types/user.ts` — 用户类型定义
  - `src/store/userStore.ts` — 用户状态
- **被依赖方**：`LoginPage`, `ProfilePage`, `UserMenu` 等 8 个组件
- **注意事项**：
  - `login()` 会同时设置 cookie 和 store，注意同步
  - Token 刷新逻辑在 `request.ts` 拦截器中
  - ⚠ 错误处理不完整，网络异常时可能无提示
```

### 分析重点

对每个核心文件，回答以下问题：
1. 这个文件解决什么问题？
2. 对外暴露什么接口（导出）？
3. 依赖哪些内部模块和外部库？
4. 被哪些模块调用？
5. 有没有明显的技术债或风险？
6. 修改这个文件会影响哪些功能？

### 文件分类清单

| 类别 | 匹配模式 | 分析深度 |
| --- | --- | --- |
| 入口文件 | `main.*`, `index.*`, `App.*`, `_app.*` | P0 完整分析 |
| 路由定义 | `router/**`, `routes.*` | P0 完整分析 |
| API 层 | `services/**`, `api/**` | P1 列出全部接口 |
| 状态管理 | `store/**`, `stores/**` | P1 列出全部模块 |
| 通用组件 | `components/**` | P2 列出名称和用途 |
| 工具函数 | `utils/**`, `helpers/**` | P2 列出主要函数 |
| 类型定义 | `types/**`, `*.d.ts` | P2 汇总类型体系 |
| 配置文件 | `*.config.*`, `.env.*` | P0 完整分析 |
| 样式文件 | `*.css`, `*.less`, `*.scss` | P3 仅标注组织方式 |
| 测试文件 | `*.test.*`, `*.spec.*`, `__tests__/**` | P3 标注覆盖范围 |

## 依赖关系图

### 分析步骤

1. 从入口文件出发，追踪 `import` 链
2. 识别分层方向（是否单向依赖）
3. 标记循环依赖或疑似循环引用
4. 识别"上帝模块"（被过多模块依赖）
5. 识别"孤岛模块"（不被任何模块引用）

### 输出格式

```text
依赖方向（自上而下）：
  页面层 (pages/)
    ↓ 依赖
  组件层 (components/) + Hook层 (hooks/)
    ↓ 依赖
  服务层 (services/) + 状态层 (store/)
    ↓ 依赖
  工具层 (utils/) + 类型层 (types/)

⚠ 异常依赖：
  - src/utils/format.ts → src/store/userStore.ts  (底层依赖上层)
  - src/components/Modal.ts ↔ src/hooks/useModal.ts  (循环引用)
```

## 快速导航索引

### 按功能模块导航

```markdown
## 快速导航

### 按模块
- [用户认证](#auth) — LoginPage, AuthService, userStore
- [数据看板](#dashboard) — DashboardPage, ChartService, useChartData
- [系统设置](#settings) — SettingsPage, ConfigService
- [报表导出](#export) — ExportService, useExport

### 按文件类型
- [入口文件](#entry) — main.ts, App.tsx, router.ts
- [API 服务](#services) — 12 个 service 文件
- [全局组件](#components) — 25 个通用组件
- [工具函数](#utils) — 18 个工具模块

### 常用命令
- `npm run dev` — 启动开发服务器 (port 3000)
- `npm run build` — 生产构建
- `npm run test` — 运行单元测试
- `npm run lint` — 代码检查
```
