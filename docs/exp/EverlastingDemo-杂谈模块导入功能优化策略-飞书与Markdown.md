# EverlastingDemo 杂谈模块导入功能优化策略 — 飞书在线文档 + 本地 Markdown 导入

> **版本**：v1.0 | **日期**：2026-08-09
> **一句话目标**：给现有「杂谈」统一内容模块（`notes/*.md` + 本地编辑器）新增两条内容导入路径：粘贴飞书在线文档链接自动拉取为 Markdown，以及选择本地 `.md` 文件解析后预填编辑器；导入结果统一走「解析 → 预填 → 人工确认 → 现有保存链路落盘」，不引入数据库、不破坏"文件即真相源"架构。
>
> **实施状态**：阶段 1（本地 Markdown 文件导入）与阶段 2（飞书在线文档导入）均已实现；阶段 3（增强项）按需实施。

---

## 一、背景与目标

### 1.1 现状（2026-08-09 对照仓库代码）

- 内容统一存放于 `notes/*.md`，frontmatter 约定 `kind: article | talk`、`title`、`date`、`description`、`cover`、`tags`、`mood`、`location`、`draft`；文件名即 slug。
- `lib/notes.ts` 是唯一数据层（读取 / 校验 / 保存 / 删除 / slug 生成），`lib/markdown.ts` 统一渲染（remark/rehype 管线）。
- 本地编辑器 `/admin/notes` 提供列表 + 新建/编辑表单 + 实时预览 + 图片上传 + 自动保存 + mtime 冲突检测；写接口仅本地 dev 可用，保存后自动 git push 发布，生产 Vercel 只读。
- **写作入口只有两个**：手改 `.md` 后 git push、编辑器逐字敲入。没有把已有内容（飞书文档、本地 Markdown 文件）批量带进系统的能力，重复搬迁成本高。

### 1.2 目标

1. **本地文件导入**：选择 `.md / .markdown / .mdown / .txt` 文件，解析 frontmatter + 正文，预填编辑器表单，确认后保存。
2. **飞书文档导入**：粘贴飞书在线文档分享链接（新版 docx / 知识库 wiki），服务端经飞书开放平台拉取官方 Markdown 导出，预填编辑器表单。
3. **不改变现有架构**：导入只是"预填编辑器的 UI 前置步骤"，最终仍走现有 `/api/notes` POST 保存链路，复用校验、预览、冲突检测、git 推送。

---

## 二、总体设计原则

| 原则 | 含义 |
|------|------|
| 文件即真相源 | 导入不直接写 `notes/`，先填表单、人工确认后才落盘 |
| 导入 ≠ 落盘 | 解析结果只存在浏览器 sessionStorage，刷新/放弃不污染仓库 |
| 单一解析管线 | 客户端只负责取文件字节，解析统一由服务端 `gray-matter` 完成，与 `lib/notes.ts` 语义完全一致 |
| 宽容解析、明确提示 | 缺字段用默认值兜底并给出 warnings；用户确认时可见 |
| 渐进式落地 | 阶段 1 本地文件导入（零外部依赖）→ 阶段 2 飞书导入（需飞书应用配置），每阶段可独立验收 |

---

## 三、导入总流程

```text
[列表页「导入」按钮] → [导入弹窗]
  ├─ 本地文件 Tab：选文件 → 读字节 → POST /api/notes/import/parse → 解析摘要展示
  └─ 飞书文档 Tab：贴链接 → POST /api/notes/import/feishu（阶段 2）→ 解析摘要展示
→ 点「导入到编辑器」 → 载荷写入 sessionStorage → 跳转 /admin/notes/new
→ 新建表单预填（标题/类型/日期/标签/正文…，来源徽标）→ 人工确认/微调
→ 现有「保存」按钮 → POST /api/notes → 落盘 notes/*.md → 自动 git push
```

预填使用 `sessionStorage` 的原因：新建页是独立路由，跳转后需要把解析结果带过去；sessionStorage 随标签页存活、关闭即清，不会像 localStorage 一样留下跨天残留。

---

## 四、本地 Markdown 文件导入（阶段 1，✅ 已实现）

### 4.1 交互

- `/admin/notes` 列表页头部新增「导入」按钮（与「+ 新建笔记」并列）。
- 弹窗默认「本地文件」Tab：支持点击选择、拖拽文件到区域。
- 解析成功后展示摘要卡片：文件名、标题、类型、日期、标签、正文字数、warnings（缺省字段/忽略的未知字段）。
- 「导入到编辑器」→ 跳转新建页，表单已预填，顶部显示「已导入：<文件名>」徽标。

### 4.2 解析接口

```text
POST /api/notes/import/parse
body: { text: string, filename: string }
→ 200 { payload: MarkdownImportPayload }
→ 400 文件为空 / 413 超过 2MB / 401 EDITOR_TOKEN 不匹配 / 403 生产环境只读
```

服务端用项目已有的 `gray-matter` 解析（客户端打包会因 gray-matter 顶层 `require("fs")` 失败，故解析必须放服务端），字段处理规则：

| frontmatter 字段 | 处理 |
|------------------|------|
| `kind` | `article` / `talk` 直接采用；其他值回退 `article` 并警告 |
| `title` | 直接采用；缺失时由文件名推导（去扩展名、`-`/`_` 转空格、剥离日期前缀） |
| `date` | 兼容 `YYYY-MM-DD` / `YYYY-MM-DD HH:MM` / YAML Date 对象；缺失或非法用当前时间并警告 |
| `tags` | 兼容数组或逗号/顿号分隔字符串 |
| `description / cover / mood / location` | 字符串透传，缺省 undefined |
| `draft` | 仅 `true` / `"true"` 视为草稿 |
| `updated` | 丢弃（保存时由服务端写入） |
| `slug` | 丢弃（文件名即 slug），并警告 |
| 其他未知字段 | 忽略并警告（前 8 个） |

`slugHint` 由服务端 `generateSlug(title, date)` 生成，供表单预填；用户在表单里仍可修改。

### 4.3 编码兜底

浏览器侧 `File.arrayBuffer()` → 先按 UTF-8（含 BOM）解码；若出现 `U+FFFD` 替换字符，用 `TextDecoder("gbk")` 重试。覆盖中文用户常见的 GBK 编码 `.md/.txt`。

---

## 五、飞书在线文档导入（阶段 2，✅ 已实现）

### 5.1 关键接口（飞书开放平台）

| 用途 | 接口 | 说明 |
|------|------|------|
| 拉取正文为 Markdown | `GET /open-apis/docs/v1/content?doc_token={token}&doc_type=docx&content_type=markdown` | 官方 Markdown 导出，覆盖标题/列表/代码/引用/任务/表格/分割线等；内容上限 10MB，限频 5 qps |
| 获取文档元信息（标题） | `GET /open-apis/docx/v1/documents/{document_id}` | 补标题字段 |
| 解析知识库链接 | `GET /open-apis/wiki/v2/spaces/get_node?token={wiki_token}` | wiki 链接里的 token 是节点 token，需解析出 `obj_token` / `obj_type` |
| 应用鉴权 | `POST /open-apis/auth/v3/tenant_access_token/internal` | `{ app_id, app_secret }` → `tenant_access_token`（2 小时过期，服务端缓存） |

所需权限：`docs:document.content:read`（查看文档内容）等；自建应用需在云文档右上角「… → 添加文档应用」授权目标文档。国际版域名 `open.larksuite.com`。

### 5.2 链接解析规则

| 分享链接形态 | 处理 |
|--------------|------|
| `https://*.feishu.cn/docx/{token}` | token 即文档 ID，直接拉取 |
| `https://*.feishu.cn/wiki/{token}` | 先调 `get_node` 解析 `obj_token`，再拉取 |
| `https://*.feishu.cn/docs/{token}` | 旧版文档，Markdown 接口不支持：提示在飞书升级新版，或降级用 `raw_content` 纯文本 |
| 裸 token（22-27 位） | 直接拉取 |

### 5.3 服务端代理与安全

- 新增 `POST /api/notes/import/feishu`，body 只含 `{ url }`；App Secret 只存在服务端环境变量，绝不下发浏览器。
- SSRF 防护：仅允许 `https://*.feishu.cn` / `https://*.larksuite.com` 链接，token 用正则严格校验，禁止任意 URL 代理。
- 飞书错误码映射为中文提示：`2889902` 无权限（提示给文档添加应用）、`2889906` 文档已删除、`2889914` token 不存在、`2889925` 内容超限、`2889901` 资源过期。

### 5.4 图片与格式处理

- 第一版：飞书导出中的图片以飞书图床公网链接形式保留（部分资源带时效）。
- 增强项（阶段 3）：解析 Markdown 图片链接 → 下载到 `public/uploads/notes/` → 替换引用，复用现有上传目录与 autopush 链路，规避图床链接过期。
- 格式清洗：飞书导出会在列表项间留空行、用反斜杠转义 Markdown 语法；导入后统一换行、折叠多余空行，并强制走一次实时预览确认。

---

## 六、编辑器预填机制

1. 列表页导入弹窗解析成功后，把 `MarkdownImportPayload` 写入 `sessionStorage["note-import:new"]`，跳转 `/admin/notes/new?from=import`。
2. 新建表单挂载时读取并**立即清除**该 key，作为各字段的初始值（优先级低于真实笔记、高于本地自动保存草稿恢复）。
3. `slugTouched` 保持 false：预填 slug 来自 `slugHint`，用户后续改标题会自动重新生成 slug。
4. 表单顶部显示「已导入：<来源名>」徽标；保存成功后走原有 `localStorage.removeItem` 清理逻辑。

---

## 七、分阶段实施与验收

| 阶段 | 内容 | 状态 | 验收标准 |
|------|------|------|----------|
| 1 | 本地 `.md` 导入：`/api/notes/import/parse` + 导入弹窗 + 表单预填 + 编码兜底 | ✅ 已实现 | 选择带/不带 frontmatter 的 `.md`（UTF-8/GBK）→ 摘要正确 → 表单预填 → 保存后 `notes/` 出现标准文件 |
| 2 | 飞书导入：`lib/feishu.ts`（token 缓存/链接解析/内容拉取）+ 代理路由 + 错误映射 + 弹窗 Tab | ✅ 已实现 | 贴 `/docx/` 与 `/wiki/` 链接可导入；错误提示可读；Secret 不进客户端 |
| 3 | 增强：图片本地化、旧版文档降级提示、OAuth 免逐个分享、导入历史 | ⏳ 按需 | 图片随 git 部署不失效；旧版文档有明确指引 |

**阶段 2 前置条件**：在[飞书开放平台](https://open.feishu.cn)创建自建应用，获取 App ID / App Secret，开通 `docs:document.content:read` 等权限并发布。凭证已配置到本地 `.env`（`FEISHU_APP_ID` / `FEISHU_APP_SECRET`，可选 `FEISHU_BASE_URL`），模板见 `.env.example`。

---

## 八、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| gray-matter 顶层 `require("fs")` | 客户端打包失败 | 解析放服务端接口，客户端只传文本（已落地） |
| 飞书图片链接时效 | 线上图片失效 | 阶段 3 图片本地化下载 |
| App Secret 泄露 | 飞书数据越权 | 纯服务端代理，客户端只传 URL |
| SSRF | 内网探测 | 域名白名单 + token 正则 |
| 旧版文档不支持 Markdown 导出 | 导入失败 | 明确报错 + 升级指引 |
| 生产环境只读 | 导入保存无效 | 导入接口沿用写接口 403 策略，发布仍走 git push |
| 飞书格式与站点渲染差异 | 观感不一致 | 导入后强制预览确认 + 空行清洗 |
| 首次配置飞书应用门槛 | 用户卡在权限 | 错误码映射中文提示 + 规划文档指引 |

---

## 九、影响面清单

**新增**

```text
app/api/notes/import/parse/route.ts   （阶段 1，已实现）
components/ImportDialog.tsx           （阶段 1，已实现）
docs/exp/EverlastingDemo-杂谈模块导入功能优化策略-飞书与Markdown.md
app/api/notes/import/feishu/route.ts  （阶段 2，已实现）
lib/feishu.ts                         （阶段 2，已实现）
```

**修改**

```text
lib/types.ts        MarkdownImportPayload + IMPORT_SESSION_KEY
components/EditorClient.tsx  列表页导入入口、表单预填、来源徽标
.env.example        FEISHU_APP_ID / FEISHU_APP_SECRET（可选 FEISHU_BASE_URL）
```

**不涉及**：`lib/notes.ts`、`lib/markdown.ts`、前台 `/notes` 展示、数据迁移。

---

## 附录：阶段 1 验收清单

- [ ] 列表页出现「导入」按钮，弹窗可打开/关闭，状态重置正确
- [ ] 拖拽或选择 `.md` 文件可解析：frontmatter 字段正确映射，未知字段被忽略并警告
- [ ] 无 frontmatter 的文件：标题取文件名、日期取当前时间、kind 默认 article，均有提示
- [ ] GBK 编码文件可正常解析（UTF-8 解码出现替换字符时自动降级）
- [ ] 空文件 / 超大文件（>2MB）有明确错误提示
- [ ] 「导入到编辑器」后新建页表单已预填，正文可直接预览渲染
- [ ] 保存后 `notes/` 生成标准 frontmatter 文件，自动推送逻辑不变
- [ ] 直接进新建页（未走导入）行为与之前完全一致
- [ ] `npm run lint && npm run build` 通过

## 附录：阶段 2 验收清单

- [ ] 未配置凭证时返回明确提示（检查 .env 的 FEISHU_APP_ID / FEISHU_APP_SECRET）
- [ ] 非飞书域名链接被拒绝（SSRF 白名单生效）
- [ ] `/docx/` 链接可拉取官方 Markdown 导出并预填编辑器
- [ ] `/wiki/` 链接先解析知识库节点再拉取（需 wiki:wiki:readonly，未开通时有明确提示）
- [ ] 旧版 `/docs/` 链接返回升级提示
- [ ] 文档未授权应用时返回 2889902 的中文指引（添加文档应用）
- [ ] 标题优先取文档元信息，缺权限时降级取正文首个 H1
- [ ] App Secret 只存在于服务端 `.env`，客户端请求仅携带链接
- [ ] `npm run lint && npm run build` 通过

---

*本文档与 `docs/exp/` 下其余规划文档配套：内容整合企划书（杂谈统一模块）、可复现高还原项目实现指南等。*
