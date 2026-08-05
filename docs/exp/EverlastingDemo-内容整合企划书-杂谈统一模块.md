# EverlastingDemo 内容整合企划书 —「杂谈」统一内容模块 + 本地编辑器

> **版本**：v1.1（专家复审查缺补漏版） | **日期**：2026-08-05
> **一句话目标**：把「说说」「杂谈」「发表的文章」三套内容体系合并为一个**「杂谈」模块**，统一目录、统一模型、统一渲染；配套一个**本地编辑器**，让"手改 Markdown 文件"与"用编辑器改"成为两条等价路径，都能修改已经发布的内容。
>
> **复审记录（v1.0 → v1.1，2026-08-05）**：以资深个人博客开发专家视角完成第一轮查缺补漏，主要增补：
> 1. 内容模型：kind 字段约束表、slug 命名与正则规范、draft 语义细化、坏文件容错策略；
> 2. 路由：SEO metadata、404/draft 处理、旧路由 301 映射表、编辑器生产环境隐藏；
> 3. 数据层：NoteMeta 完整定义、校验器、缓存失效、元数据/正文分离读取；
> 4. 编辑器：图片插入与图床策略、自动保存、slug 唯一性校验、冲突检测、移动端方案；
> 5. 迁移：备份、dry-run、缺字段补默认值细则、redirect 映射生成、迁移后校验；
> 6. 全局：搜索/统计/归档口径、README 与 .env.example 同步；
> 7. 风险：补充坏 frontmatter、误删、路径穿越、生产暴露、构建缓存/发布延迟、本地图片、多设备冲突等 7 项，并强化并发覆盖对策；
> 8. 新增附录 D（查缺补漏记录）并扩展现有附录。
>
> **实施状态（2026-08-05）**：阶段 0-4 已全部落地（数据模型 / 展示整合 / 本地编辑器 / 数据迁移 / 打磨与文档），`npm run build` 与端到端验证通过；阶段 5 的 kind 深链已落地；旧目录与旧路由按待决策项 4 完成删除，301 配置已移除。

---

## 一、背景与动机

### 1.1 现状（2026-08-05 对照仓库代码）

| 内容类型 | 存放目录 | 列表页 | 详情页 | 首页入口 | 归档 |
|----------|----------|--------|--------|----------|------|
| 文章 | `posts/` | 无独立列表，仅首页轮播 | `/posts/[slug]` | LatestPostsCarousel | `/timeline` 只读 posts |
| 杂谈 | `chatters/` | `/chatter` | `/chatter/[slug]` | LatestChatterCarousel | 未纳入 |
| 说说 | `moments/`（兼容 `posts/moments/` 双目录扫描） | `/moments` | 无详情页，卡片内展开 | 无 | 未纳入 |

导航栏同时存在「说说」「杂谈」两个入口；首页同时渲染两套轮播；关于页按三类内容分别生成活动时间线。

**补充事实（影响方案设计，2026-08-05 核对）**：

- **评论系统已移除**：当前项目无 Gitalk/Comments（`package.json` 与 `components/` 均无），本文档不假设评论存在；若未来接入，统一详情页预留评论位即可。
- **图片与资源现状**：封面/说说图片目前均为外链 URL（Unsplash 等），本地无上传目录；编辑器插入图片必须明确"图床外链 vs 本地 `public/uploads/`"策略（见 §3.4 图片策略）。
- **读取链路分散**：首页内建两段读取（posts/chatters）、归档只读 posts、搜索只喂文章、关于页三目录分别生成活动时间线；这些都将收敛到 `lib/notes.ts` 单一数据层。
- **部署语义**：站点部署于 Vercel（SSR + 构建期 `generateStaticParams`），内容变更依赖 git push 触发构建；编辑器"写本地文件"不等于"线上生效"（见 §3.5 发布语义）。

### 1.2 为什么需要调整

| # | 痛点 | 具体表现 |
|---|------|----------|
| 1 | **心智负担重** | 一篇内容是"文章"还是"杂谈"还是"说说"，没有客观边界，全凭作者临时判断；放错目录后要改文件位置、改链接，成本高 |
| 2 | **代码重复** | `app/posts/[slug]/page.tsx` 与 `app/chatter/[slug]/page.tsx` 各自维护约 200 行几乎相同的渲染与样式代码；`app/page.tsx` 内建两段读取逻辑；`lib/markdown.ts` 的预清洗在三个页面各有一份 |
| 3 | **信息分散** | 首页双轮播、ProfileCard 计数分离、归档只收录文章、搜索只喂文章——读者无法在一个地方看完"这个人的全部输出" |
| 4 | **更新方式单一** | 只能手改 `.md` 后 git push；没有预览、没有表单、容易写错 frontmatter；"已发布文章"想快速改一句话也要打开编辑器改文件 |
| 5 | **细节行为不一致** | 说说支持双目录放置；杂谈详情有日历、文章详情有 TOC；同一套数据三种读取方式，后续维护会持续放大差异 |

### 1.3 调整目标

1. **单一真相源**：一个目录、一套类型、一套读取与渲染管线。
2. **统一呈现**：一个「杂谈」模块承接全部内容，用 `kind`（类型）做 Tab 筛选，文章/杂谈/说说同列表、同详情框架。
3. **双路径写作**：Markdown 文件直改 与 本地编辑器修改 完全等价，都作用于同一批文件。
4. **平滑迁移**：旧目录脚本迁移、旧路由 301 重定向，内容零丢失、旧链接不失效。
5. **不引入后端/数据库**：继续"文件系统 + git"，编辑器只是"写 Markdown 文件的 UI"。

---

## 二、设计原则

| 原则 | 含义 |
|------|------|
| 文件即真相源 | `notes/*.md` 是唯一权威数据；任何页面、任何 API 都从磁盘读取，编辑器保存就是写文件 |
| kind 是元数据而非目录 | 不再按内容类型分目录，全部平铺在一个 `notes/` 里，用 frontmatter `kind` 区分 |
| 编辑器不持有数据 | 编辑器没有自己的"草稿库"或"数据库"，保存即落盘，重启不丢、与 md 直改天然一致 |
| 渐进式落地 | 展示整合 → 编辑器 → 数据迁移 → 文档，每步可独立验收，任何一步中断都不影响站点可用 |
| 本地优先 | 编辑器面向本地写作场景；生产环境（Vercel）文件系统只读，编辑器进入只读或隐藏状态，发布仍走 git |

---

## 三、方案设计

### 3.1 统一内容模型：`notes/`

```text
notes/
├── 2026-08-04-hello-world.md     # kind: article（原 posts/hello-world.md）
├── 2026-08-04-fragment.md        # kind: talk（原 chatters/xxx.md）
└── 2026-08-04-status.md          # kind: moment（原 moments/xxx.md）
```

统一 frontmatter 规范（增量字段已标注）：

```yaml
---
kind: article          # 必填。article=文章 / talk=杂谈 / moment=说说
title: "标题"           # 文章/杂谈必填；说说可省略（展示时取正文首行）
date: 2026-08-04 22:30 # 必填。兼容 YYYY-MM-DD 与 YYYY-MM-DD HH:MM
updated: 2026-08-05 10:00  # 新增。编辑器保存时自动更新，供"最近更新"展示
description: "摘要"     # 可选。缺省时取正文前 100 字
cover: "https://..."   # 可选。缺省用 siteConfig.defaultPostCover
tags: [日常]           # 可选。列表筛选/归档用
mood: "开心"           # 可选。talk/moment 展示心情徽章
location: "北京"       # 可选。moment 展示定位
images: ["https://..."] # 可选。moment 展示图片九宫格
draft: false           # 新增。true 时列表/搜索/归档均不展示，仅编辑器可见
---
正文 Markdown...
```

**slug 规范**：文件名即 slug，只允许小写字母/数字/中划线（`^[a-z0-9]+(?:-[a-z0-9]+)*$`），建议格式 `yyyy-mm-dd-<英文或拼音标题>`；编辑器新建时自动生成，保存前校验唯一性与正则。

**kind 与字段约束**：

| 字段 | article | talk | moment | 说明 |
|------|---------|------|--------|------|
| title | 必填 | 必填 | 可选（缺省取正文首行） | 列表/详情标题 |
| date | 必填 | 必填 | 必填 | 写作/发布时间 |
| updated | 自动 | 自动 | 自动 | 编辑器保存时写入 |
| description | 推荐 | 可选 | 可选 | 缺省取正文前 100 字 |
| cover | 可选 | 可选 | - | 缺省用 siteConfig.defaultPostCover |
| tags | 可选 | 可选 | 可选 | 筛选/归档 |
| mood | - | 可选 | 可选 | 心情徽章 |
| location | - | - | 可选 | 定位 |
| images | - | - | 可选 | 图片九宫格/灯箱 |
| draft | 可选 | 可选 | 可选 | true=仅编辑器可见 |

**draft 语义**：`draft: true` 的笔记不进入任何前台入口（列表/搜索/归档/首页/详情直链一律 404）；把已发布笔记改为 draft 等同下线。编辑器 `/editor` 列表默认展示全部（含 draft）。

**坏文件容错**：`lib/notes.ts` 解析时若单个文件 frontmatter 非法（缺 kind/date、kind 越界、slug 非法），默认**跳过该文件并在 dev/build 输出警告**（`--strict` 校验模式可升级为报错），避免一个坏文件拖垮整站。

> 兼容说明：`mood / location / images` 对特定 kind 有意义，但模型上允许共存，避免"字段不属于该类就报错"的耦合。`slug` 不存 frontmatter，文件名即 slug。

### 3.2 路由与页面设计

| 路由 | 实现文件 | 说明 |
|------|----------|------|
| `/notes` | `app/notes/page.tsx` + `components/NoteBoard.tsx` | 统一列表：kind Tab（全部/文章/杂谈/说说）+ 搜索 + 标签筛选 + 瀑布流 |
| `/notes/[slug]` | `app/notes/[slug]/page.tsx` | 统一详情：按 kind 条件渲染（文章→TOC、talk→心情、moment→定位/图片/可选评论位） |
| `/notes/page/[n]`（可选） | 列表页内实现 | 量级大时启用分页或"加载更多"；个人博客量级默认滚动加载即可 |
| `/editor` | `app/editor/page.tsx` + `components/EditorClient.tsx` | 本地编辑器入口：笔记列表 + 新建按钮 |
| `/editor/[slug]` | `app/editor/[slug]/page.tsx` + `components/EditorClient.tsx` | 编辑指定笔记 |
| `/api/notes` | `app/api/notes/route.ts` | GET 列表 / POST 新建 / PUT 更新 / DELETE 删除（仅本地 dev 可写） |
| `/api/notes/render` | 同一 route 或独立 `render/route.ts` | 编辑器实时预览用的 Markdown 渲染（与服务端同一管线） |
| `/posts/[slug]` `/chatter` `/chatter/[slug]` `/moments` | 旧路由保留 | 迁移期 301 → `/notes/...`；一个版本周期后删除 |
| `/sitemap.xml`、`/feed.xml`（可选） | `app/sitemap.ts`、`app/feed.xml/route.ts` | SEO/RSS 增强，阶段 4 或 5 接入 |

**SEO 与 metadata**：`/notes` 生成统一 title/description；`/notes/[slug]` 用 frontmatter 动态生成 metadata（title/description/OG/标签），draft 笔记返回 404 且不进 sitemap。

**404 与 draft 处理**：slug 不存在或 `draft: true` 时，详情页统一走 `notFound()`（自定义 404 文案"内容不存在或未发布"），避免 draft 被直链访问。

**旧路由 301 映射表**（迁移期）：

| 旧路由 | 新地址 |
|--------|--------|
| `/posts/[slug]` | `/notes/[slug]`（slug 冲突改名时按迁移报告映射） |
| `/chatter/[slug]` | `/notes/[slug]` |
| `/chatter` | `/notes` |
| `/moments` | `/notes?kind=moment` |

> 若迁移产生 slug 改名（冲突后缀 `-2` 等），301 目标以迁移报告生成的映射表为准（写入 `data/redirects.ts` 或 `next.config.ts` redirects 数组，见 §3.6）。

导航调整：

- PC 导航与移动端轮盘：删除「说说」，保留「杂谈」（指向 `/notes`，站点名可继续用 siteConfig 的"云端杂谈"）。
- 导航项 9 → 8 项，移动端轮盘角度计算自动重排（现有代码基于 `navLinks.length`，无需额外改动）。

### 3.3 数据层：`lib/notes.ts`

新增一个数据层文件，替代目前分散在 `page.tsx`、`chatter/[slug]`、`posts/[slug]`、`moments`、`timeline`、`about` 的读取逻辑：

```typescript
// lib/notes.ts —— 统一内容数据层（含校验与容错）
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { NoteMeta, NoteKind } from './types';
import { normalizeDate } from './dates';

export const NOTES_DIR = path.join(process.cwd(), 'notes');
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS: NoteKind[] = ['article', 'talk', 'moment'];

export function isValidSlug(slug: string): boolean { return SLUG_RE.test(slug); }

export function validateNoteMeta(slug: string, data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!isValidSlug(slug)) errors.push(`slug 非法: ${slug}`);
  if (!KINDS.includes(data.kind as NoteKind)) errors.push(`${slug}: kind 缺失或非法`);
  if (!data.date || isNaN(new Date(data.date as string).getTime())) errors.push(`${slug}: date 缺失或不可解析`);
  return errors;
}

export function getAllNotes(options?: { includeDraft?: boolean }): NoteMeta[] {
  if (!fs.existsSync(NOTES_DIR)) return [];
  return fs.readdirSync(NOTES_DIR)
    .filter((f) => f.endsWith('.md'))
    .flatMap((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      if (!isValidSlug(slug)) { console.warn(`[notes] 跳过非法文件名: ${fileName}`); return []; }
      const { data, content } = matter(fs.readFileSync(path.join(NOTES_DIR, fileName), 'utf8'));
      const errors = validateNoteMeta(slug, data);
      if (errors.length) { console.warn(`[notes] ${errors.join('; ')}`); return []; }
      return [{
        slug, ...(data as NoteMeta), content,
        date: normalizeDate(data.date) || data.date,
        excerpt: data.description || content.replace(/^#+ .*\n/m, '').substring(0, 100),
      }];
    })
    .filter((n) => options?.includeDraft || !n.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getNote(slug: string): NoteMeta | null {
  if (!isValidSlug(slug)) return null;
  return getAllNotes({ includeDraft: true }).find((n) => n.slug === slug) || null;
}

export function saveNote(input: { slug: string; data: NoteMeta; content: string }) {
  if (!isValidSlug(input.slug)) throw new Error('slug 非法');
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(NOTES_DIR, `${input.slug}.md`),
    matter.stringify(input.content.trim() + '\n', input.data),
    'utf8'
  );
  invalidateNotesCache();
}

export function deleteNote(slug: string) {
  if (!isValidSlug(slug)) throw new Error('slug 非法');
  fs.rmSync(path.join(NOTES_DIR, `${slug}.md`), { force: true });
  invalidateNotesCache();
}

// 缓存：编辑器写入后必须失效（TTL 或显式 invalidate，见下方缓存策略）
function invalidateNotesCache() { /* lib/cache.ts 的 clear('notes') */ }
```

同时：

- `lib/types.ts` 新增 `NoteMeta`（`ChatterMeta`、`MomentMeta` 保留为兼容别名或直接废弃）：

  ```typescript
  export type NoteKind = 'article' | 'talk' | 'moment';
  export interface NoteMeta {
    slug: string; kind: NoteKind; title: string; date: string;
    updated?: string; description?: string; cover?: string;
    tags?: string[]; mood?: string; location?: string;
    images?: string[]; draft?: boolean; content: string; excerpt?: string;
  }
  ```

- **元数据/正文分离读取**：列表/搜索/归档只需要 frontmatter（`getAllNotesMeta` 不读正文，或读取后仅保留 excerpt），详情页才需要完整正文，控制首页/列表的 IO 与内存开销。
- **缓存策略**：小站可不缓存；笔记 >100 篇时用 `lib/cache.ts`（TTL 60s）或 `export const revalidate = 60`（ISR）；编辑器 `saveNote/deleteNote` 后必须失效对应缓存，避免"保存了前台看不到"。
- 渲染统一走现有 `lib/markdown.ts`（renderMarkdown / extractToc），删除三处页面内重复实现。

### 3.4 本地编辑器设计

#### 界面布局（示意）

```text
┌──────────────── 编辑器 · /editor/[slug] ────────────────┐
│ [类型] article ▾  [标题] 你好，世界                      │
│ [日期] 2026-08-04 [标签] 博客,开始 [心情] 开心 [草稿] ☐  │
│ [封面] https://...  [摘要] ...                          │
│ ──────────────────────────────────────────────────────── │
│ [保存]  [删除]  [返回列表]                               │
├──────────────────── 源码 ────────────┬── 实时预览 ───────┤
│ # 你好世界                           │ 你好世界          │
│ 正文 Markdown...                     │ 渲染后的效果...   │
│ ...                                  │ 代码高亮/公式...  │
└──────────────────────────────────────┴───────────────────┘
```

#### 功能清单

| 功能 | 说明 |
|------|------|
| 双栏编辑 | 左 Markdown 源码（textarea，零依赖起步），右实时预览；预览调 `/api/notes/render`，与服务端同一 remark/rehype 管线，保证所见即所得 |
| 元数据表单 | kind / title / date / tags / mood / location / images / cover / description / draft 一一对应 frontmatter 规范 |
| 保存 | 校验必填 → `matter.stringify` 序列化 → PUT `/api/notes` 写回 `notes/{slug}.md` → Toast 反馈；`updated` 自动写入当前时间 |
| 新建/删除 | 列表页新建（自动生成 slug 建议：`yyyy-mm-dd-<标题拼音/英文>`）；删除需二次确认 |
| 列表管理 | `/editor` 展示全部笔记（含 draft），可搜索、可按 kind 筛选 |
| 草稿 | `draft: true` 的笔记只出现在编辑器，前台列表/搜索/归档一律过滤 |
| 图片插入 | 粘贴/拖拽图片：本地模式保存到 `public/uploads/notes/`，或提示改用图床外链（见下方图片策略）；插入时自动转为 markdown 图片语法 |
| 自动保存 | 编辑内容防抖写入浏览器 localStorage，关闭/刷新可恢复；`Ctrl/Cmd+S` 触发正式保存；离开前有未保存修改时提示 |
| slug 编辑 | 新建时自动生成 slug，允许修改；保存前校验正则与唯一性（与现存笔记冲突时提示改 slug） |
| 冲突检测 | 保存前请求服务端文件 mtime/hash，若磁盘文件已被 md 直改或其他入口修改，提示"覆盖 or 取消"（见 §3.5） |
| 移动端 | 编辑器桌面优先；窄屏自动切单栏（源码编辑为主、预览折叠），保留保存能力 |

**图片策略（待决策 7）**：

- **方案 A（推荐，零额外服务）**：编辑器插入图片保存到 `public/uploads/notes/`，随 git 提交部署；本地插入即本地生效，线上随构建同步。
- **方案 B**：纯图床外链，编辑器只负责填 URL/粘贴图床链接；自动上传图床需要额外服务，本期不做。
- 注意：Vercel 构建只保留仓库内 `public/`，**运行时写入的图片不会保留**，因此图片保存必须发生在本地并随 git 提交。

#### API 契约

```text
GET    /api/notes            → 200 [{ slug, kind, title, date, updated, draft, ... }]
POST   /api/notes            → 201 { slug }（body: { data, content }）
PUT    /api/notes            → 200 { slug }（body: { slug, data, content }）
DELETE /api/notes?slug=xxx   → 204
POST   /api/notes/render     → 200 { html }（body: { content }）
```

**错误约定**：400 参数校验失败（slug 非法 / kind 越界 / date 不可解析）；403 生产环境写操作；404 slug 不存在；409 POST 新建时 slug 已存在（需改 slug）。

#### 可用性与安全

- **仅本地可写**：`app/api/notes` 的写操作在 `NODE_ENV === 'production'` 时返回 403 或 404；生产环境编辑器页面隐藏写入口并提示"请编辑本地文件后 git push"。
- **无鉴权起步**：本地个人使用，默认不鉴权；可选 `EDITOR_TOKEN`（写入请求头）防止局域网误触。
- **路径穿越防护**：服务端与前端双重 `isValidSlug` 校验；slug 只允许 `[a-z0-9-]`，写接口只操作 `notes/` 目录内的 `.md` 文件。
- **文件系统真相**：编辑器保存后页面强制重新读盘再渲染，避免内存态与磁盘不一致。

### 3.5 双路径一致性说明

| 路径 | 流程 | 为什么结果一致 |
|------|------|----------------|
| md 直改 | 编辑 `notes/x.md` → git push | 渲染端永远读磁盘 |
| 编辑器 | `/editor/x` 保存 → 写回 `notes/x.md` → git push | 渲染端读的是同一文件 |

一致性由三件事保证：frontmatter 规范是唯一契约；编辑器表单与规范一一对应；渲染端只认磁盘文件、不认内存缓存（生产可后续加 `lib/cache.ts`，但写入后需清缓存或短 TTL）。

**发布语义**：编辑器保存只改本地文件，要让线上生效必须 `git push`（Vercel 触发构建）。本地 `npm run dev` 下保存后刷新前台立即可见；若使用 SSG/`generateStaticParams`，新增或修改的笔记在**下一次构建**后才出现在线上（见 §6 风险表"新笔记线上不出现"）。

**并发/多入口冲突**：`md 直改`与`编辑器`同时改同一文件时，以"保存前对比磁盘 mtime/hash"作为最后防线：编辑器保存时若检测到磁盘文件已被外部修改，先弹窗提示覆盖或取消；git 作为最终兜底（冲突可 `git diff`/`git checkout` 恢复）。

### 3.6 迁移方案

新增 `scripts/migrate-notes.mjs`：

```text
posts/*.md            → notes/*.md  kind: article
chatters/*.md         → notes/*.md  kind: talk
moments/*.md          → notes/*.md  kind: moment
posts/moments/*.md    → 并入（沿用现有双目录扫描 + Map 去重）
```

迁移规则：

1. **前置备份**：迁移前强制要求 `git commit`（或打 tag `backup/notes-migration`）；旧目录不删除，只标记为只读归档（是否最终删除取决于待决策项 4）。
2. 文件名即 slug；跨目录同名时保留先到者，冲突者加 `-2`、`-3` 后缀，并把"旧 slug → 新 slug"写入迁移报告（用于生成 301 映射）。
3. 自动补默认字段：`kind` 按来源目录；`title` 缺失取文件名；`date` 缺失取文件 mtime；`description` 缺省取正文前 100 字；`cover` 缺省用 `siteConfig.defaultPostCover`；`tags` 缺省 `[]`。
4. 说说沿用双目录扫描 + Map 去重（id=文件名），去重规则与现状一致。
5. **dry-run 优先**：脚本支持 `node scripts/migrate-notes.mjs --dry-run`，只输出迁移报告（含冲突清单）不写文件；确认后再正式执行。
6. 迁移完成后运行 `scripts/validate-notes.mjs` 校验全部 notes（kind/date/slug/必填字段），输出非法文件清单；全部通过才允许删除旧目录。
7. 根据迁移报告生成重定向：写入 `data/redirects.ts`（或 `next.config.ts` redirects），覆盖 `/posts/[slug]`、`/chatter`、`/chatter/[slug]`、`/moments`；重定向保留一个版本周期（待决策项 4）。

### 3.7 首页与全局整合

| 位置 | 现状 | 整合后 |
|------|------|--------|
| 首页轮播 | LatestPostsCarousel + LatestChatterCarousel 两套 | 一个 LatestNotesCarousel：取最新 5 条，卡片带 kind 徽章 |
| ProfileCard | 文章数 / 说说数分离 | 合并为"笔记总数"（可按 kind 细分文案） |
| 归档 /timeline | 只读 posts | 读 notes/ 全部，支持按 kind 筛选 |
| 搜索 SearchBar | 只喂文章 | 喂 notes/ 全部（含 talk/moment 标题与正文），结果带 kind 徽章，支持 `?kind=` 深链 |
| 关于页活动时间线 | 三类内容三组 | 统一 notes 时间线，kind 作为类型标签 |
| siteConfig | chatterTitle/chatterDescription | 增加 `notesTitle` 或沿用，统一文案口径 |
| SiteDashboard | 统计口径分散 | 统一为：笔记总数 + kind 分类计数 + 最近更新时间 |
| metadata / README | 站点描述与文档未同步 | 更新站点 description；README 增加"写作方式（md 或 /editor）"；`.env.example` 增加 `EDITOR_TOKEN`（可选） |

> 所有消费方（首页/归档/搜索/关于/统计）统一走 `lib/notes.ts` 的同一份数据，避免再次出现"某个入口漏掉某类内容"的现状。

---

## 四、分阶段实施计划

| 阶段 | 工作内容 | 验收标准 | 预估工时 |
|------|----------|----------|----------|
| 0 数据模型 | `lib/types.ts` 增加 NoteMeta/NoteKind；新增 `lib/notes.ts`（含 validateNoteMeta 与坏文件容错）；编写统一 frontmatter 规范示例；可选单测 | `getAllNotes()` 正确读取三类示例并排序；非法文件被跳过且输出警告 | 1-2h |
| 1 展示整合 | `/notes` 列表（kind Tab + 搜索 + 标签）与 `/notes/[slug]` 详情（SEO metadata、draft 404）；首页/归档/搜索/关于改读 notes/；导航去掉「说说」；旧路由 301 | 三类内容在同一列表可筛选；详情按 kind 正确渲染；draft 直链 404；旧链接 301 可达 | 3-5h |
| 2 本地编辑器 | `/api/notes`（GET/POST/PUT/DELETE + render，含错误约定与路径穿越防护）；`/editor` 与 `/editor/[slug]`；保存/新建/删除/草稿/自动保存/冲突检测/图片插入 | 编辑器可新建、修改、删除笔记并落盘；重启 `npm run dev` 后内容仍在；生产构建中写接口返回 403、/editor 隐藏 | 4-6h |
| 3 数据迁移 | 迁移脚本（dry-run + 备份 + 冲突报告）；`validate-notes.mjs`；redirects 映射；README 与 siteConfig 文案 | 数据零丢失；迁移报告无未决冲突；全部 notes 通过校验；旧链接全部可达 | 1-2h |
| 4 打磨与文档 | 编辑器样式与移动端适配；draft 过滤；SEO metadata；README/.env.example 同步；同步更新本文档族 | `npm run lint && npm run build` 通过；文档与实现一致 | 1-2h |
| 5 可选增强（不阻塞上线） | 见下方「阶段 5 详细展开」 | 见「阶段 5 详细展开」各项验收 | 视选择项 3-5h |

> 建议顺序：先做阶段 0-1（纯展示整合，不碰写盘），验证三类内容在新模块下的观感；再做阶段 2 编辑器；最后迁移存量数据。阶段 1 完成即可单独部署。

**阶段 5（可选增强，不阻塞上线）**：详见下方「阶段 5 详细展开」。

### 阶段 5 详细展开（可选增强，不阻塞上线）

> **现状盘点（2026-08-05）**：sitemap / robots / feed / OG meta 均未落地；kind 深链（5.4）已落地；多设备冲突检测编辑器已实现（mtime → 409），但缺使用约定文档；旧目录、旧路由与 301 已全部删除（只保留 `/notes`）。下表 5.1-5.6 为原清单，5.7-5.8 为本次新增建议。

| # | 项目 | 优先级 | 为什么值得做 | 工作量 |
|---|------|--------|--------------|--------|
| 5.1 | RSS `/feed.xml` | 🟡 推荐 | 个人博客订阅标配，Feedly/Inoreader 等聚合；顺带是 SEO 辅助信号 | 0.5-1h |
| 5.2 | `sitemap.xml` + `robots.txt` | 🟡 推荐 | 搜索引擎更快收录新笔记；Next 原生支持（`app/sitemap.ts` / `app/robots.ts`），零依赖 | 0.5-1h |
| 5.3 | OG 封面图与社交分享 meta | 🟡 推荐 | 微信/QQ/Telegram/推特分享卡片目前只有 title/description，没有图 | 0.5-1h |
| 5.4 | kind 深链（`/notes?kind=`、`/timeline` 筛选） | 🟢 中 | 补上 301 落地缺口，让 `/moments` 旧链接真实生效；筛选结果可分享/可收藏 | 1h |
| 5.5 | 多设备编辑冲突指引文档 | 🟢 低 | 编辑器已有 409 冲突检测，缺"先 pull 再编辑、同一笔记单入口"约定 | 0.2h |
| 5.6 | 迁移报告自动生成 redirects | ✅ 已完成并移除 | 迁移已结束；旧路由与 301 已按待决策项 4 删除，仅未来再改名时需脚本化 | 0h |
| 5.7 | 图片懒加载与外链图本地化（新增） | 🟢 低 | 长文图片多时 `loading="lazy"` 省流量；外链图可下载到 `public/uploads/notes/` 规避图床防盗链/失效，与已实现的上传功能衔接 | 1h |
| 5.8 | 可选接入评论系统 Giscus / Waline（新增） | ⚪ 看需求 | 对应待决策项 9；Giscus 免后端（GitHub Discussions）、Waline 需自托管，个人博客按需选 | 2-4h |

#### 5.1 RSS `/feed.xml`

- **实现要点**：`app/feed.xml/route.ts` 返回 `application/rss+xml`；复用 `getAllNotesMeta()`（自动过滤 draft），按 `date` 降序；条目含 `title` / `link`（`https://域名/notes/[slug]`）/ `description`（缺省取 excerpt）/ `content:encoded`（全文或前 200 字，二选一）；注意 XML 转义（`&`、`<`、`>`）；可选 `?kind=` 生成分类 feed。
- **验收**：访问 `/feed.xml` 返回合法 XML（可用解析器校验），含全部已发布笔记；draft 不出现。

#### 5.2 sitemap 与 robots

- **实现要点**：`app/sitemap.ts` 输出静态路由（`/`、`/about`、`/notes`、`/music`、`/photowall`、`/friends`、`/projects`、`/timeline`）+ 每条笔记详情（draft 排除），`lastModified` 取 `updated || date`；`app/robots.ts` 声明 `Sitemap: https://域名/sitemap.xml`。
- **验收**：`/sitemap.xml` 与 `/robots.txt` 均 200；sitemap 含 4 篇笔记与静态页；draft 不在其中。

#### 5.3 OG 封面图与社交分享

- **实现要点**：`siteConfig` 增加站点绝对地址字段（如 `url: "https://everlasting-demo.vercel.app"`）；`app/notes/[slug]/page.tsx` 的 `generateMetadata` 补 `openGraph`（title/description/type=article/images=[cover]）与 `twitter.card = "summary_large_image"`；`/`、`/notes`、`/about` 补基础 og 字段。**关键**：og:image 必须是绝对 URL（`new URL(cover, siteConfig.url)`），封面缺省用 `defaultPostCover`。
- **验收**：用社交调试工具（或浏览器查看 meta）能看到 `og:image` 指向封面且为绝对地址。

#### 5.4 kind 深链

- **实现要点**：Next 15+/16 中 `searchParams` 是 `Promise`，`/notes/page.tsx` 改为 async 并 `await searchParams`，把 `kind` 传给 `NoteBoard` 作初始 `activeKind`；`NoteBoard` 在 Tab 变化时用 `router.replace("/notes?kind=...")` 同步 URL（可选）；`/timeline` 同理支持 `?kind=` 与 `?tag=`。`SearchBar` 结果已带 kind 徽章，无需再改。
- **验收**：访问 `/notes?kind=moment` 自动选中「说说」；`/moments` 301 落地后效果一致；`/timeline?kind=article` 筛选生效。

#### 5.5 多设备编辑冲突指引

- **实现要点**：README 或本文档附录补一小节：同一笔记同时只保留一个编辑入口；换设备先 `git pull` 再编辑；编辑器保存时若检测到磁盘文件被外部修改会返回 409 并提示刷新；git 是最终兜底（`git diff` / `git checkout -- notes/xxx.md` 恢复）。
- **验收**：README 有「多设备编辑」小节，覆盖上述约定。

#### 5.6 迁移报告自动生成 redirects

- **状态**：已完成并移除（迁移落地；2026-08-05 按待决策项 4 删除旧目录/旧路由，`next.config.ts` 不再含 301）。仅当未来发生笔记改名/目录调整时，可写 `scripts/gen-redirects.mjs` 从迁移报告生成配置。

#### 5.7 图片懒加载与本地化（新增建议）

- **实现要点**：在 `lib/markdown.ts` 的 rehype 插件里与 `referrerPolicy` 一并注入 `loading="lazy"`；`NoteImages` / 轮播卡片同样处理；可选写 `scripts/download-images.mjs` 把笔记里的外链图下载到 `public/uploads/notes/` 并批量替换引用（注意只处理可公开下载的图床，防盗链图需带 Referer 或换源）。
- **验收**：长文图片懒加载生效（滚动到可视区才加载）；本地化后的图随 git 部署不失效。

#### 5.8 评论系统（新增建议）

- **说明**：Giscus 依赖 GitHub Discussions（国内访问一般），Waline 需要自托管后端；两者都只需在 `/notes/[slug]` 预留的评论区位挂组件。个人博客可暂缓，属"读者互动"需求驱动。

**推荐执行顺序**：5.4（补 301 落地缺口，成本最低收益最直接）→ 5.2 + 5.3（SEO/分享基础）→ 5.1（订阅）→ 5.5（文档，顺手）→ 5.7 / 5.8（按需）。

---

## 五、影响面清单

**新增**

```text
app/notes/page.tsx
app/notes/[slug]/page.tsx
app/editor/page.tsx
app/editor/[slug]/page.tsx
app/api/notes/route.ts
lib/notes.ts
components/NoteBoard.tsx
components/EditorClient.tsx
components/LatestNotesCarousel.tsx
scripts/migrate-notes.mjs
scripts/validate-notes.mjs
data/redirects.ts（可选，迁移报告生成）
public/uploads/notes/（可选，本地图片存储）
```

**修改**

```text
app/page.tsx（单轮播 + 统一取数）
components/ProfileCard.tsx / SiteDashboard.tsx / Navbar.tsx / SearchBar.tsx
app/timeline/page.tsx、app/about/page.tsx
lib/types.ts（NoteMeta）、siteConfig.ts（文案/计数）
next.config.ts（redirects，若走配置文件方式）
README.md（写作方式说明）、.env.example（EDITOR_TOKEN 可选）
app/not-found.tsx（draft/缺失笔记的 404 文案）
```

**删除（迁移完成后）**

```text
app/moments/  app/chatter/  app/posts/[slug]/
components/LatestPostsCarousel.tsx  components/LatestChatterCarousel.tsx
posts/  chatters/  moments/
```

---

## 六、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Vercel 等 Serverless 平台文件系统只读、构建时重置 | 线上编辑器写了也存不住 | 编辑器仅在本地 dev 可写；生产隐藏写入口；发布仍走 git push；未来可选 GitHub API 写仓或本地 CMS |
| 编辑器与 md 直改并发覆盖 | 一方改动丢失 | 保存前对比磁盘 mtime/hash 并提示"覆盖 or 取消"；同一笔记同一时间只保留一个编辑入口；git 是最终兜底 |
| 迁移时 slug 冲突 | 内容被覆盖或链接错乱 | 脚本冲突检测 + 后缀规则 + 迁移报告；迁移前 git commit 留档 |
| 旧链接失效 | 友链/搜索引擎 404 | 301 redirects 至少保留一个版本周期 |
| frontmatter 手写与编辑器字段不一致 | 展示异常 | 统一规范文档 + 编辑器字段映射 + 迁移后校验脚本（字段名/必填项检查） |
| 三类内容的视觉差异丢失 | 细节观感下降 | 详情页按 kind 条件渲染徽章/图片/评论/TOC，统一框架内保留差异 |
| 单个坏 frontmatter 文件拖垮整站 | 某篇笔记格式错误导致列表/首页 500 | `lib/notes.ts` 容错跳过 + 警告；`--strict` 校验模式可升级为报错；`validate-notes.mjs` 提前发现 |
| 编辑器误删/误改 | 内容丢失 | 删除二次确认；git 兜底（`git diff`/`git checkout` 恢复）；可选"删除前自动备份到 `backups/`" |
| slug 路径穿越/注入 | 写接口可越权写任意文件 | 服务端+前端双重 `isValidSlug`；写接口只操作 `notes/` 目录内 `.md`；拒绝 `..`、绝对路径、非常规扩展名 |
| 生产误暴露编辑器/写接口 | 任何人可改/删内容（虽写盘无效） | `/editor` 生产 404；写接口 `NODE_ENV=production` 一律 403；可选 `EDITOR_TOKEN` |
| 新笔记线上不出现（SSG/构建缓存） | push 后看不到新内容 | 明确"发布=git push 触发 Vercel 构建"；`generateStaticParams` 构建期生成；需要即时更新时用 ISR（`revalidate`） |
| 本地图片引用在 Vercel 丢失 | 运行时上传的图片不随构建保留 | 图片必须保存在仓库 `public/` 并随 git 提交；图床外链不受影响 |
| 多设备/多入口编辑冲突 | 同步后内容互相覆盖 | 保存前 hash/mtime 冲突检测 + git 合并兜底；文档写明"同一笔记同时只保留一个编辑入口" |

---

## 七、待决策事项

| # | 事项 | 推荐方案 | 备选 |
|---|------|----------|------|
| 1 | 统一目录名 | `notes/`（语义中立，不再暗示"只能放某类"） | 沿用 `chatters/` |
| 2 | 列表路由 | `/notes` | 沿用 `/chatter` |
| 3 | kind 取值 | `article` / `talk` / `moment` | 中文值 / 其他枚举 |
| 4 | 旧目录与旧路由保留期 | ✅ 已执行：2026-08-05 全部删除（旧目录、旧路由、301 均移除，只保留 `/notes`） | 保留一个版本周期后删除 |
| 5 | 编辑器鉴权 | 本地无鉴权 | `EDITOR_TOKEN` |
| 6 | 编辑器底层 | textarea + 实时预览（零依赖） | CodeMirror / Monaco |
| 7 | 图片存储 | 本地 `public/uploads/notes/` + git 提交（方案 A） | 纯图床外链（方案 B） |
| 8 | 列表分页 | 不做，滚动加载即可（个人量级） | `/notes/page/[n]` 分页 |
| 9 | 评论系统 | 暂不接入（当前已无评论） | 未来接 Gitalk/Waline 时在统一详情页预留评论位 |

---

## 附录 A：统一 frontmatter 完整示例

````markdown
---
kind: article
title: "你好，世界"
date: 2026-08-04 22:30
updated: 2026-08-05 10:00
description: "这是我的第一篇文章，用于验证统一内容管线。"
cover: https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop
tags: [博客, 开始]
---

## 欢迎来到我的博客

这是整合后的第一篇笔记。支持 **加粗**、*斜体*、`行内代码`、表格、删除线 ~~旧文字~~。

```python
def hello():
    print("Hello, World!")
```

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$
````

## 附录 B：统一 frontmatter 校验要点（迁移后脚本检查）

```text
必填：kind ∈ {article, talk, moment}；date 可被 new Date() 解析
建议：title 非空（moment 允许缺省）；updated 在编辑器保存后写入
可选：description / cover / tags / mood / location / images / draft
禁止：slug 字段（文件名即 slug，避免双真相）
slug：仅小写字母/数字/中划线 ^[a-z0-9]+(?:-[a-z0-9]+)*$
坏文件策略：跳过 + 警告（默认）；--strict 升级为报错
draft 语义：true 时前台列表/搜索/归档/详情直链全部不可见
```

## 附录 C：验收清单

- [ ] `notes/` 下三类文件在 `/notes` 同一列表可分别筛选
- [ ] `/notes/[slug]` 对 article 显示 TOC、talk 显示心情、moment 显示定位/图片
- [ ] 首页单轮播、导航只剩「杂谈」一个内容入口
- [ ] 旧链接 `/posts/x`、`/chatter/x`、`/moments` 301 到新地址
- [ ] 编辑器可新建/编辑/删除并写回 `notes/*.md`，重启后内容仍在
- [ ] `draft: true` 的笔记前台不可见
- [ ] 生产构建下写接口返回 403，编辑器进入只读态
- [ ] 单个坏 frontmatter 文件不影响整站（被跳过且警告）
- [ ] slug 冲突迁移有报告且 301 映射正确
- [ ] 编辑器图片插入（本地 uploads 或图床外链）可用，线上不丢图
- [ ] `/notes` 与 `/notes/[slug]` 有正确 metadata，draft 不进 sitemap
- [ ] README 与 `.env.example` 已同步；`EDITOR_TOKEN` 可选生效
- [ ] 新笔记 git push 后线上出现（构建触发），本地 dev 保存后刷新可见
- [ ] `npm run lint && npm run build` 通过

## 附录 D：查缺补漏记录（v1.0 → v1.1）

| 区域 | 增补内容 |
|------|----------|
| 现状盘点 | 补充评论已移除、图片全为外链、读取链路分散、Vercel 部署语义四项事实 |
| 内容模型 | kind 字段约束表、slug 正则规范、draft 语义、坏文件容错策略 |
| 路由 | 分页/加载更多（可选）、sitemap/feed（可选）、SEO metadata、draft 404、旧路由 301 映射表 |
| 数据层 | NoteMeta/NoteKind 完整类型、validateNoteMeta、元数据/正文分离读取、缓存失效 |
| 编辑器 | 图片插入与两种图片策略、自动保存、slug 唯一性校验、mtime/hash 冲突检测、移动端单栏、错误约定、路径穿越防护 |
| 双路径一致性 | 发布语义（git push 才上线）、SSG/ISR 说明、并发冲突最后防线 |
| 迁移 | 前置备份、dry-run、缺字段补默认值细则、validate-notes、redirects 生成 |
| 全局整合 | SiteDashboard 统计口径、搜索 kind 徽章与深链、README/.env.example 同步 |
| 风险 | 新增 7 项（坏文件、误删、路径穿越、生产暴露、构建缓存、本地图片、多设备）+ 强化并发覆盖对策 |
| 待决策 | 新增图片存储、列表分页、评论系统 3 项 |

---

*本企划书（v1.1）与 `docs/exp/` 下其余四份文档配套使用：整合指南、策略文档、审核报告、XHBlogs 分析指南。*
