# EverlastingDemo 独立前端实现策略技术文档（优化版 v2.1）

> **目标**：完全去掉 Python CMS 后端和管理端，仅保留参考项目 XHBlogs 的前端部分，以最小成本搭建本项目 **EverlastingDemo**（功能完整、UI 高还原的个人博客）。
>
> **版本**：v2.1（优化版 · EverlastingDemo） | **基于**：XinghuisamaBlogs/XHBlogs 源码（已观察） | **复核时间**：2026-08-04
>
> **优化依据**：`XHBlogs-项目分析指南.md`（项目结构、技术栈、概念地图）+ 原《XHBlogs-审核报告与优化实现计划》（四轮审核发现，已并入 EverlastingDemo 审核优化版 v3.1）
>
> **证据标签**：`[已观察]`=直接读取源码确认；`[推断]`=由结构/调用关系得出；`[待确认]`=需要环境验证。
>
> **范围变更（2026-08-04）**：AI 猫猫功能（CyberCat / `app/api/chat` / Gemini / `GEMINI_API_KEY`）已按需求**完全移除**，本版实施清单、功能矩阵、依赖与环境变量均不再包含该功能；文中保留的原项目分析仅作参考。
>
> **命名约定**：**EverlastingDemo** = 本项目（GitHub: `LingLuoMuYun/EverlastingDemo`）；**XHBlogs** = 参考项目前端目录（`XinghuisamaBlogs/XHBlogs`），仅作源码参考。

---

## 更新说明（v1.0 → v2.1）

1. 全部技术事实对照 `XinghuisamaBlogs/XHBlogs` 源码复核，修正 5 处错误、补全 18 处缺失（详见文末附录 C 勘误对照表）。
2. 首页布局描述更正为**源码实际结构**（ProfileCard + CloudPlayer + LyricBar + 文章轮播 + 照片墙大海报 + 说说轮播 + 主题切换块 + SiteDashboard）。
3. 补全错误边界、空状态、`about.md`、路径别名、Gitalk 安全等关键实践。
4. 依赖清单按真实 `package.json` 重写，标注 `next-themes`、`openai`、`@tiptap/*` 等实际未使用/残留依赖。
5. 新增「技能-实施步骤映射表」与「功能矩阵」，打通技术分析与实施路线。
6. 按需求移除 AI 猫猫功能（CyberCat / `app/api/chat` / Gemini），本版不再包含该功能的实施内容。
7. 项目品牌化为 **EverlastingDemo**，与参考项目 XHBlogs 明确区分。

---

## 目录

1. [架构总览](#一架构总览)
2. [路由体系](#二路由体系)
3. [内容模型与数据层](#三内容模型与数据层)
4. [核心 UI 组件](#四核心-ui-组件)
5. [API 代理层](#五api-代理层)
6. [样式系统与主题](#六样式系统与主题)
7. [特效系统](#七特效系统)
8. [状态管理](#八状态管理)
9. [部署与发布](#九部署与发布)
10. [渐进式实施路线](#十渐进式实施路线)

---

## 一、架构总览

### 1.1 技术选型（已观察，依据 `XHBlogs/package.json`）

```
Next.js 16.2.1 (App Router, SSR 模式)
├── React 19.2.4 (RSC + Client Components)
├── TypeScript 5 (strict, 路径别名 @/*)
├── Tailwind CSS v4 + @tailwindcss/postcss
├── 动画：Framer Motion 12.38.0
├── Markdown：unified + remark + rehype 生态
├── 代码高亮：highlight.js 11.11.1（Atom One Dark）
├── 数学公式：KaTeX 0.16.45
├── 评论：Gitalk 1.8.0（GitHub OAuth 代理）
├── 3D/特效：three 0.184 + @react-three/fiber 9.6.1 + drei 10.7.7
└── 内容存储：文件系统（Markdown + TypeScript 数据文件）
```

**核心理念**：零数据库、零后端服务、纯文件驱动。所有内容在请求/构建时通过 Node.js `fs` 模块读取，服务端渲染为 HTML；需要外部服务的能力（AI、音乐、天气、评论 OAuth）统一走 Next.js API Route 代理。

**依赖现状说明（已观察）**：`XHBlogs/package.json` 是从管理端复制来的，包含 **Tiptap 系列（13 个包）、next-themes、openai** 等前端展示并不使用的依赖。其中：

| 依赖 | 实际用途 | 结论 |
|------|---------|------|
| `@tiptap/*`（13 个） | 管理端富文本编辑器残留 | 前端可全部移除 |
| `next-themes` | 未在任何文件 import（[已观察] 全仓搜索无引用） | 可移除，主题由自研 ThemeProvider 实现 |
| `openai` | 未在任何文件 import（原 chat 路由直连 Gemini REST，现已随 AI 猫猫删除） | 可移除 |
| `lucide-react` | 被 MobileBackButton、MusicClient、tree 系列、GlobalToolbox、CalculatorTool 使用 | **保留**（勿按 v1.0 建议随意删除） |
| `remark-html` / `remark` | package.json 中存在，页面实际未 import | 可移除（保留 unified 主链即可） |

### 1.2 组件分层（已观察）

```
app/                    ← 页面层（路由入口 + 数据获取 + metadata）
  ├── layout.tsx        ← 全局布局（Provider + 背景层 + 特效层 + 覆盖层）
  ├── page.tsx          ← 首页（SSR，fs 读取 posts/chatters + albums）
  ├── posts/[slug]/     ← 文章详情（SSR + generateStaticParams）
  ├── chatter/[slug]/   ← 杂谈详情（SSR + generateStaticParams + 日历）
  ├── about/            ← 关于页（app/about/about.md + 活动时间线）
  ├── moments/          ← 说说列表（双目录扫描）
  ├── friends/          ← 友链（客户端岛 FriendsBoard）
  ├── music/            ← 音乐馆（客户端岛 MusicClient）
  ├── photowall/        ← 照片墙（客户端岛 PhotoWallClient）
  ├── projects/         ← 项目矩阵（客户端岛 ProjectsBoard）
  ├── timeline/         ← 归档（TimelineClient）
  ├── tree/             ← 灵境/创意工坊（AlchemyLab + DijiangModel）
  └── api/              ← API 代理路由（chat/music/weather/github/test）

components/             ← 通用组件层（已观察共 38+ 文件）
  ├── 布局类：Navbar, PageTransition, BackButton, MobileBackButton
  ├── 内容类：ProfileCard, SiteDashboard, SearchBar, Comments, ClientTOC, ClientSocials
  ├── 特效类：BackgroundEffects, BackgroundSlider, DanmakuBackground, Sakura,
  │          Fireflies, GlobalSnow, WindyGrass, WeatherEffect, ClickEffect, SplashScreen
  ├── 音乐类：MusicProvider, FloatingPlayer, CloudPlayer, LyricBar, SidebarLyric, MusicPlayer
  ├── 功能类：GlobalToolbox, WeatherWidget, ThemeToggleBlock
  ├── 内容列表：LatestPostsCarousel, LatestChatterCarousel, TimelineClient, TimelineNode,
  │            MomentComments, LabComments
  ├── 关于页：AboutClient
  └── 基础类：ThemeProvider, ToastProvider

data/                   ← 静态数据（albums.ts / friends.ts / projects.ts）
siteConfig.ts           ← 全局配置中心（单文件真相源）
posts/ chatters/ moments/  ← Markdown 内容
public/                 ← 静态资源（spaceship.bin、CNAME）
```

### 1.3 数据流全景（已观察）

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                         │
└────────────┬───────────────────────┬────────────────┘
             │                       │
    ┌────────▼────────┐    ┌────────▼────────┐
    │  SSR 页面        │    │  Client 组件     │
    │  (RSC)           │    │  ("use client")  │
    │                  │    │                  │
    │  fs.readFileSync │    │  fetch(/api/music)│
    │  gray-matter     │    │  fetch(/api/     │
    │  unified 渲染    │    │  fetch(/api/     │
    │                  │    │    weather)       │
    └────────┬─────────┘    └────────┬─────────┘
             │                       │
    ┌────────▼─────────┐    ┌────────▼─────────┐
    │  文件系统          │    │  API Routes       │
    │  posts/*.md       │    │  (Vercel 服务端)   │
    │  data/*.ts        │    │  → 网易云 API      │
    │  siteConfig.ts    │    │  → 和风天气 API     │
    └──────────────────┘    │  → 和风天气 API     │
                            │  → GitHub OAuth    │
                            └───────────────────┘
```

**关键约定**：服务端组件负责数据获取，客户端组件只做交互；数据通过 props 从服务端流向客户端，避免客户端重复请求。所有 `fs` 操作只允许出现在 `async` 服务端组件中。

---

## 二、路由体系

### 2.1 路由清单（已观察，对照 `XHBlogs/app/`）

| 路由 | 文件 | 渲染模式 | 数据源 |
|------|------|----------|--------|
| `/` | `app/page.tsx` | SSR（动态） | `posts/*.md` + `chatters/*.md` + `data/albums.ts` |
| `/posts/[slug]` | `app/posts/[slug]/page.tsx` | SSR + `generateStaticParams` | `posts/{slug}.md` |
| `/chatter/[slug]` | `app/chatter/[slug]/page.tsx` | SSR + `generateStaticParams` | `chatters/{slug}.md` |
| `/about` | `app/about/page.tsx` | SSR（动态） | `app/about/about.md` + 三类内容活动时间线 |
| `/moments` | `app/moments/page.tsx` | SSR（动态） | `posts/moments/*.md` + `moments/*.md`（双目录去重） |
| `/friends` | `app/friends/page.tsx` | SSR 外壳 + 客户端岛 | `data/friends.ts` |
| `/music` | `app/music/page.tsx` | SSR 外壳 + 客户端岛 | `siteConfig.cloudMusicIds` → `/api/music` |
| `/photowall` | `app/photowall/page.tsx` | 客户端岛（无 Navbar 外壳） | `data/albums.ts` |
| `/projects` | `app/projects/page.tsx` | SSR 外壳 + 客户端岛 | `data/projects.ts` |
| `/timeline` | `app/timeline/page.tsx` | SSR + 客户端岛 | `posts/*.md`（标签计数 + 年月归档） |
| `/tree` | `app/tree/page.tsx` | SSR 数据 + 客户端岛 | `posts/chatters/moments`（创意工坊） |
| `/api/music` | `app/api/music/route.ts` | Serverless | 网易云音乐 API |
| `/api/weather` | `app/api/weather/route.ts` | Serverless | 和风天气 API |
| `/api/github` | `app/api/github/route.ts` | Serverless | GitHub OAuth |
| `/api/test` | `app/api/test/route.ts` | Edge Runtime | 健康检查 |

> ⚠️ `/tree` 不是"目录树浏览"，而是**灵境（创意工坊）**：`CreativeWorkshopClient` 内含 `AlchemyLab`（饱和渐近经验升级系统）与 `DijiangModel`（3D 模型展示），`OperatorRecreation` 已注释停用。[已观察]

### 2.2 三种页面实现模式（已观察）

#### 模式 A：纯服务端渲染页面

首页、文章详情、杂谈详情、关于页、说说页。特点：`fs` 读取 + `gray-matter` 解析 + 服务端组件 `async`。

```typescript
// app/posts/[slug]/page.tsx — 关键实现路径（已观察）
export async function generateStaticParams() {
  const postsDirectory = path.join(process.cwd(), 'posts');
  if (!fs.existsSync(postsDirectory)) return [];   // 目录不存在返回空数组
  const filenames = fs.readdirSync(postsDirectory);
  return filenames
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ slug: name.replace(/\.md$/, '') }));
}

async function getPostData(slug: string) {
  const fullPath = path.join(process.cwd(), 'posts', `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  let { data, content } = matter(fileContents);
  // ... 文本预清洗 + unified 渲染（见 §2.3）
  return { slug, contentHtml, toc, title: data.title, date: data.date,
           tags: data.tags && Array.isArray(data.tags) ? data.tags : [],
           cover: data.cover || siteConfig.defaultPostCover };
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;              // Next 15+ 参数为 Promise
  const postData = await getPostData(resolvedParams.slug);
  const recentPosts = getRecentPosts(resolvedParams.slug);  // 相关推荐（3 篇）
  return ( /* ... 封面 + 标题 + prose + Comments + 侧栏 ... */ );
}
```

#### 模式 B：服务端外壳 + 客户端岛屿

友链、项目、音乐、照片墙、时间线、灵境。服务端只负责 `metadata` + 布局，交互逻辑委托给 `"use client"` 子组件。

```typescript
// app/friends/page.tsx — 服务端外壳（已观察）
import { siteConfig } from "@/siteConfig";   // 注意：使用 @/* 别名

export const metadata = { title: "友链 | " + siteConfig.title };

export default function FriendsPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28"><FriendsBoard /></div>
      </PageTransition>
    </div>
  );
}
```

#### 模式 C：全客户端页面

照片墙（`PhotoWallClient` 自带 Navbar/PageTransition）、音乐馆（`MusicClient`）。两者仍由服务端 `page.tsx` 导出 metadata，但内容完全客户端渲染。

### 2.3 Markdown 内容渲染管线（已观察，三处页面同款实现）

`posts/[slug]`、`chatter/[slug]`、`about` 三个页面各自实现了同一套渲染管线（约 80 行重复代码，建议抽取为 `lib/markdown.ts`）：

```
.md 文件
  ├─ gray-matter 解析（data=Frontmatter, content=正文）
  ├─ 文本预清洗（关键，顺序不能乱）
  │   ├─ 统一换行符 \r\n → \n
  │   ├─ 清理纯空格行 ^[ \t]+$ → ''
  │   ├─ 修复数字列表 1.xxx → 1. xxx（^(\s*\d+)\.([^ \n])）
  │   ├─ 按代码块切分（```[\s\S]*?``` 或 ~~~），代码块原样保留
  │   ├─ 无语言标记的代码块补 ```cpp（chatter/about 页面特有）
  │   └─ 正文区 \n{3,} → \n\n + <br> × (n-2) + \n\n（保留连续空行）
  ├─ unified 处理器链
  │   ├─ remarkParse → MDAST
  │   ├─ remarkGfm（表格、删除线、任务列表）
  │   ├─ remarkMath（$...$ / $$...$$）
  │   ├─ remarkRehype({ allowDangerousHtml: true })   ← 必须开，<br> 才能通过
  │   ├─ rehypeHighlight({ detect: true, ignoreMissing: true, subset: [...] })
  │   ├─ rehypeKatex
  │   └─ rehypeStringify({ allowDangerousHtml: true })
  └─ 输出 contentHtml → dangerouslySetInnerHTML 注入 <div class="prose">
```

**高亮语言白名单（已观察）**：`['cpp','c','python','java','javascript','typescript','go','rust','bash','json','html','css','sql','xml']` —— 作用是限制自动检测范围、减小 highlight.js 体积，同时提高命中率。

**排版样式**：详情页通过 `<style>` 注入整段 `.prose` 覆盖（h1-h3 字号、链接虚线边框、引用块果冻风、代码块 Atom One Dark、hljs token 颜色、移动端媒体查询）。样式在三个详情页间也有重复，同样建议抽取为 `app/prose.css` 或 `lib` 常量。

---

## 三、内容模型与数据层

### 3.1 siteConfig.ts — 全局配置中心（已观察，字段与源码一致）

```typescript
export const siteConfig = {
  title: string,               // 网站标题（浏览器标签 / metadata）
  faviconUrl: string,          // 网站图标 URL
  authorName: string,          // 作者名
  bio: string,                 // 个人简介
  navTitle: string,            // 导航栏左侧标题
  navSuffix: string,           // 分隔符（默认 "の"）
  navAfter: string,            // 导航栏右侧文字
  avatarUrl: string,           // 头像 URL
  useGradient: boolean,        // true=渐变背景 / false=图片背景（控制 BackgroundSlider 是否渲染）
  themeColors: string[],       // 流动渐变色（4 色）
  bgImages: string[],          // 背景图片 URL 数组（useGradient=false 时生效）
  defaultPostCover: string,    // 文章默认封面
  photoWallImage: string,      // 首页照片墙预览图
  cloudMusicIds: string[],     // 网易云音乐 ID 列表
  social: { github, gitee, google, email, qq, wechat },  // 社交链接/复制文案
  counts: { photos: number },  // 照片统计（首页备用）
  chatterTitle: string,        // 杂谈标题
  chatterDescription: string,  // 杂谈副标题
  danmakuList: string[],       // 背景弹幕文案
  gitalkConfig: { clientID, clientSecret, repo, owner, admin: string[] },
  buildDate: string,           // 建站日期（ISO）
  footerBadges: Array<{ name: string; color: string; svg: string }>,
  icpConfig: { name: string; link: string },
  // geminiConfig（AI 猫猫配置，已按需求删除）
  friendLinkApplyFormat: string,  // 友链申请格式模板
  enableLevelSystem: boolean,     // 灵境页等级系统开关
};
```

**注意**：`social.google` 字段名为"google"，但实际渲染为普通外链 `<a href>`（若留空则不渲染）；v1.0 文档"实际是 mailto:"的说法在 XHBlogs 前端源码中未观察到，仅存在于管理端语境，建议字段更名或统一。

### 3.2 Markdown 内容文件

```
posts/                     chatters/                  moments/
├── first.md               ├── 2026-03-25-           ├── moment-1777128883968.md
├── 2222.md                │   originium-research.md ├── ...
└── long-test-article.md   └── ...                   └── ...
```

**Frontmatter 规范（已观察）**：

```yaml
---
title: "文章标题"           # 必填
date: 2026-03-25            # 必填；首页 formatUpdateTime 同时支持 YYYY-MM-DD 和 YYYY-MM-DD HH:MM
description: "文章摘要"      # 可选，用于首页卡片和 SEO
cover: "https://..."        # 可选，封面图 URL（缺省用 siteConfig.defaultPostCover）
tags: [标签1, 标签2]        # 可选，用于归档/详情页标签
mood: "开心"                # 仅杂谈使用（详情页 ✨心情 徽章）
location: "北京"            # 仅说说使用
images: ["url1", "url2"]    # 仅说说使用
---
```

**通用读取模式**（建议抽取为 `lib/posts.ts`；首页 `page.tsx` 内建了等效实现，含 `formatUpdateTime` 与按日期+slug 排序）：

```typescript
export function getAllMarkdownFiles(dirName: string) {
  const dir = path.join(process.cwd(), dirName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(fileName => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, fileName), 'utf8'));
      return { slug: fileName.replace(/\.md$/, ''), ...data, content,
               excerpt: data.description || content.substring(0, 100) };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
```

### 3.3 TypeScript 数据文件（已观察，接口与原文件一致）

```typescript
// data/albums.ts
export interface Photo { url: string; caption?: string; }
export interface Album {
  id: string; title: string; description: string;
  cover: string; date: string; photos: Photo[];
}
export const albums: Album[] = [ /* ... */ ];

// data/friends.ts
export interface Friend {
  id: string; name: string; url: string; description: string;
  avatar: string; themeColor: string;
}
export const friendsData: Friend[] = [ /* ... */ ];

// data/projects.ts
export type Project = {
  id: string; name: string; description: string;
  icon: string; githubUrl: string; tags: string[];
};
export const projectsData: Project[] = [ /* ... */ ];
```

> ⚠️ **接口必须随数据一起导出**：`PhotoWallClient`、`FriendsBoard`、`ProjectsBoard` 会直接 `import { albums, Album }` 等，空文件若缺少 interface 导出会导致编译失败。

---

## 四、核心 UI 组件

### 4.1 全局布局（app/layout.tsx，已观察）

 实际结构（与 v1.0 的主要差异：`FloatingPlayer`、`GlobalToolbox`、`ClickEffect`、`DanmakuBackground`、`BackgroundEffects` 全部**仅桌面端渲染** `hidden md:block`；移动端只有 `MobileBackButton`）：

```tsx
<html lang="zh-CN" className="... h-full antialiased" suppressHydrationWarning>
  <head>
    <style>{`
      #app-mount-root { opacity: 0; visibility: hidden; pointer-events: none; }
      html.splash-seen #app-mount-root { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
    `}</style>
    <script>{`try { if (sessionStorage.getItem('hasSeenSplash') === 'true')
      document.documentElement.classList.add('splash-seen'); } catch(e) {}`}</script>
  </head>
  <body className="w-screen overflow-x-hidden min-h-full flex flex-col relative
                   transition-colors duration-1000 bg-slate-50 dark:bg-slate-950 font-serif">
    <ThemeProvider>
      <SplashScreen />
      <MusicProvider>
        <div id="app-mount-root" className="flex-1 flex flex-col transition-opacity duration-1000">
          {/* 背景层 fixed inset-0 z-[-1] pointer-events-none */}
          {!siteConfig.useGradient && <BackgroundSlider />}      {/* 图片背景 */}
          <div className="absolute inset-0 z-[-9] bg-white/30 dark:bg-slate-900/40 backdrop-blur-md" />
          <div className="absolute inset-0 z-[-8] opacity-60 dark:opacity-20 mix-blend-color"
               style={{ background: `linear-gradient(-45deg, ${siteConfig.themeColors.join(', ')})`,
                        backgroundSize: '400% 400%', animation: 'gradientMove 15s ease infinite' }} />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/40 dark:bg-indigo-900/20 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-purple-900/30 blur-[100px] rounded-full z-[-7] md:mix-blend-overlay" />
          <div className="hidden md:block absolute inset-0 w-full h-full"><BackgroundEffects /></div>

          <div className="hidden md:block"><DanmakuBackground /></div>
          <div className="relative z-10 flex-1 flex flex-col">{children}</div>
          <div className="hidden md:block"><FloatingPlayer /></div>
          <div className="hidden md:block"><GlobalToolbox /></div>
          <div className="md:hidden block"><MobileBackButton /></div>
          <div className="hidden md:block"><ClickEffect /></div>
        </div>
        {/* @keyframes gradientMove 由 layout 内联 <style> 定义 */}
      </MusicProvider>
    </ThemeProvider>
  </body>
</html>
```

**z-index 分层**：背景层 `z-[-1]`（图片轮播 → 白色遮罩 `-9` → 渐变混色 `-8` → 光晕 `-7`）→ 弹幕 `z-0` → 内容层 `z-10` → 导航栏 `z-50` → 移动端菜单 `z-[60~70]` → 浮动组件 `z-[9999]`。

**闪屏联动**：`#app-mount-root` 初始隐藏，`SplashScreen` 首次访问显示 2.2s，退出动画后 `+500ms` 给 `html` 加 `splash-seen` 类，CSS 放行内容。`sessionStorage('hasSeenSplash')` 记录已看状态。

### 4.2 导航栏（Navbar.tsx，已观察）

**桌面端**：顶部固定毛玻璃条（`bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl`），10 个链接：首页/项目/归档/照片墙/音乐/灵境/说说/杂谈/友链/关于。当前路由高亮为 indigo 文字 + 底部脉冲圆点；滚动监听：向下超过 80px 隐藏（`-translate-y-full`），向上恢复。

**移动端**：右侧可纵向拖拽的触发球（`drag="y"` + 视口约束），点击展开 **320×320 全圆转轴**：

```typescript
const rawRotation = useMotionValue(0);
const smoothRotation = useSpring(rawRotation, { stiffness: 200, damping: 25 });
const inverseRotation = useTransform(smoothRotation, (r) => -r);

const handlePan = (event: any, info: PanInfo) => {
  // 计算手指相对圆心的角度差，累加到 rawRotation
  // 子项通过 style={{ transform: `rotate(${angle}deg) translateY(-115px) rotate(${-angle}deg)` }} 均匀排布
  // 内容再套 inverseRotation，保证拖拽时文字保持正向
};
```

**注意**：移动端轮盘使用 `mobileNavLinks`（过滤掉 `/tree` 灵境），保证 9 项自动均匀排布。[已观察]

### 4.3 首页布局（app/page.tsx，已观察 — 与 v1.0 描述不同）

```
┌─────────────────────────────────────────────────────┐
│                     Navbar                           │
├─────────────────────────────────────────────────────┤
│                SearchBar（居中）                      │
├──────────────────────────────┬──────────────────────┤
│  ProfileCard（7 列）          │  CloudPlayer（5 列）  │
│  头像+简介+统计+社交          │  首页音乐卡片          │
├──────────────────────────────┴──────────────────────┤
│                    LyricBar（歌词栏）                 │
├──────────────┬──────────────────────────────────────┤
│  LatestPosts │  照片墙大海报（Link → /photowall）     │
│  Carousel(4) ├───────────────┬──────────────────────┤
│  最新文章轮播  │ LatestChatter │ ThemeToggleBlock     │
│              │ Carousel(2列)  │ (1列 日夜切换)       │
├──────────────┴───────────────┴──────────────────────┤
│                  SiteDashboard（时钟+运行时间+徽章）   │
└─────────────────────────────────────────────────────┘
```

要点（已观察）：

- 最外层包 `ToastProvider`；整页 `PageTransition` 淡入上滑。
- 首页是服务端组件：`fs` 读取 `posts/`、`chatters/`，`albums.reduce` 计算真实照片数，`top5Posts`/`top5Chatters` 取前 5；**空目录时注入占位对象**（`slug:'none'`、标题"暂无文章/暂无记录"），轮播组件对 `slug==='none'` 不跳转。
- `formatUpdateTime` 同时支持 `YYYY-MM-DD`（显示 `2026.03.25`）和带时间格式（显示 `2026.03.25 14:30`）。
- 照片墙大海报取 `albums[0]`（最新相册），空时用 `siteConfig.photoWallImage` 兜底。
- **首页没有友链/项目独立卡片**（v1.0 的 ASCII 有误）；友链/项目通过导航进入独立页面。

### 4.4 音乐系统（已观察）

```
MusicProvider (Context)
├── 挂载时 fetch(`/api/music?ids=${siteConfig.cloudMusicIds.join(',')}`)
├── 过滤无 url/报错的歌曲 → 组装 { id,title,artist,cover,src,lyrics }
├── LRC 解析：parseLrc() 正则 [mm:ss(.xxx)]，剔除控制字符，按时间排序
├── <audio> 元素：onTimeUpdate → progress/currentTime/currentLyric
├── 播放模式：loop → single → random（togglePlayMode 循环切换）
│   ├── single：ended 时 currentTime=0 重播
│   └── random：next/prev 每次取随机 index（非随机队列）
└── 暴露：togglePlay, nextSong, prevSong, handleSeek, playSong, setVolume, toggleMute

CloudPlayer（首页卡片）
├── 黑胶唱片旋转（animate-[spin_6s_linear_infinite]，播放时 running）
├── 打字机歌词（50ms/字递增显示 currentLyric）
├── 进度条/时间/上一首/播放暂停/下一首（事件全部 stopPropagation 防冒泡）
└── 点击卡片空白区域 → router.push('/music')

FloatingPlayer（仅桌面端，首页隐藏不销毁）
├── fixed bottom-6 right-6 z-[9999]
├── animate: { opacity: isHidden ? 0 : 1, scale: 0.8/1, pointerEvents }
├── 首页 isHidden（pathname==='/'），其它页面可拖拽
└── 光碟封面 + 歌名 + 滚动歌词 + 播放/下一首

MusicClient（/music 全屏播放器）
├── 黑胶大唱片动画 + 逐行高亮歌词（activeLyricRef 自动滚动）
├── 歌词/歌单双 Tab、音量滑条、播放模式切换
├── 歌单搜索（前端过滤）+ 评论区（Comments）
└── lucide-react 图标（Play/Pause/Shuffle/Disc3/...）
```

### 4.5 AI 猫猫助理（已按需求删除）

> 该功能不在本次实施范围：不复制 `CyberCat.tsx`、`app/api/chat/`、`public/siamese-cat.png`，layout 不挂载，siteConfig 不含 `geminiConfig`，无需 `GEMINI_API_KEY`。原项目实现（CSS sprite 帧动画 + Gemini REST 对话）仅作历史参考，详见原版策略文档。

### 4.6 评论系统（Comments.tsx，已观察）

```typescript
"use client";
useEffect(() => {
  if (!containerRef.current) return;
  containerRef.current.innerHTML = '';   // 关键：路由切换前清空，防重复渲染
  const gitalk = new Gitalk({
    clientID: siteConfig.gitalkConfig.clientID,
    clientSecret: siteConfig.gitalkConfig.clientSecret,  // 安全建议：改环境变量注入
    repo, owner, admin,
    proxy: '/api/github',                // 同源代理绕跨域
    id: (pathname.replace(/\/$/, '') || '/').substring(0, 49),
    distractionFreeMode: false,
  });
  gitalk.render(containerRef.current);
  // 登录回调后擦除 URL ?code= 参数（replaceState 无痕）
  const url = new URL(window.location.href);
  if (url.searchParams.has('code')) { url.searchParams.delete('code');
    window.history.replaceState({}, document.title, url.toString()); }
}, [pathname]);
```

- 通过 `<style jsx global>` 的 `.custom-gitalk-glass` 前缀覆盖 Gitalk 默认样式为毛玻璃（textarea、按钮、评论卡片、头像圆角、链接色）。
- 顶部有 indigo 环境光晕装饰（`blur-3xl`）+ 细边框分隔。

### 4.7 搜索栏（SearchBar.tsx，已观察）

- 纯前端过滤：`title` / `description` / `tags` 三路匹配（大小写不敏感）。
- 结果面板 `AnimatePresence` 展开，`<mark>` 高亮命中文字（`escapeRegExp` 防正则注入）。
- 展示标题、日期、摘要、标签；点击跳转 `/posts/[slug]`；点击外部关闭。

### 4.8 其他重要组件（已观察）

| 组件 | 关键实现 |
|------|----------|
| PageTransition | `motion.div` initial `{y:20,opacity:0}` → animate，0.8s easeOut |
| BackButton | `router.back()` + 毛玻璃胶囊样式 |
| MobileBackButton | `fixed bottom-24 right-4 z-[90]`，lucide ChevronLeft |
| ProfileCard | 整卡点击跳 `/about`；统计 文章/杂谈/照片；社交按钮（github/gitee/google 外链，email/qq/wechat 复制到剪贴板 + Toast） |
| SiteDashboard | 每秒刷新时钟（等宽黑底翻页风）、`buildDate` 起算运行天数/小时、footerBadges 徽章、ICP 链接 |
| SplashScreen | 头像旋转光环 + 进度条 + "INITIALIZING SYSTEM"，2.2s 后退出 |
| ThemeToggleBlock | 日夜滑动切换动画（🌸/✨），点击切换主题 |
| ThemeProvider | 自研 Context：默认 dark，`localStorage('blog-theme')`，未挂载前渲染 `invisible` 防闪屏 |
| ToastProvider | `showToast(text, type)` 顶部滑入，3s 自动消失 |
| ClientTOC | 文章目录，滚动高亮当前标题 |
| ClientSocials | 社交图标组（详情页侧栏复用） |
| LatestPostsCarousel | 5s 自动轮播，渐变交叉淡入淡出，底部小圆点 |
| LatestChatterCarousel | 6s 自动轮播，holo 模糊缩放变体 |
| GlobalToolbox | 桌面端左下/右下工具箱（含 CalculatorTool 计算器） |

---

## 五、API 代理层（已观察）

| 路由 | 方法 | 代理目标 | 必需环境变量 |
|------|------|----------|-------------|
| `/api/music?ids=` | GET | 网易云 `music.163.com/api` | 无 |
| `/api/weather` | GET | 和风天气 v7 | `QWEATHER_KEY` |
| `/api/github` | POST | `github.com/login/oauth/access_token` | 无 |
| `/api/test` | GET | - | 无 |

### 5.1 Chat API（已按需求删除）

> 不创建 `app/api/chat/`，前端不调用，无需 `GEMINI_API_KEY`。如需恢复，参考原版策略文档 §5.1（源码 `XHBlogs/app/api/chat/route.ts`：Edge Runtime + Gemini REST，双 Key 兜底 `GEMINI_API_KEY || OPENAI_API_KEY`）。

### 5.2 Music API（已观察）

- 必须带 `User-Agent` + `Referer: https://music.163.com/` 请求头，否则网易云拒绝。
- 每首歌并行请求 `song/detail` 与 `song/lyric`，`AbortSignal.timeout(6000)`。
- 播放地址用外链模板 `https://music.163.com/song/media/outer/url?id=${id}.mp3`。
- 返回统一结构 `{ id, name, artist, author, cover, pic, url, lrc }`，失败项 `{ id, error }`（前端过滤）。

### 5.3 Weather API（已观察）

- `QWEATHER_KEY` 缺失返回 500；尝试 `api.qweather.com` 与 `devapi.qweather.com` 两个 Host。
- Bearer Token 认证（`Authorization: Bearer ${token}`），`cache: 'no-store'`。
- 写死北京 `101010100`，可自行改成配置项。

### 5.4 GitHub OAuth 代理（已观察）

- 读取 Gitalk 请求的原始 body，原样转发 `github.com/login/oauth/access_token`，`Accept: application/json`，响应回传前端。完全绕开浏览器跨域。

---

## 六、样式系统与主题

### 6.1 基础层（已观察，`app/globals.css` 全文）

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@layer base {
  :root { --font-serif: var(--font-serif), "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif; }
  body { font-family: var(--font-serif); @apply transition-colors duration-1000 text-slate-900 bg-slate-50;
         -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  .dark body { @apply text-slate-100 bg-slate-950; }
  h1, h2, h3, h4 { font-weight: 900; letter-spacing: -0.02em; }
  .dark .prose { --tw-prose-body: var(--color-slate-200); --tw-prose-headings: var(--color-white);
                 --tw-prose-links: var(--color-indigo-400); }
  [class*="backdrop-blur-"] { will-change: backdrop-filter; -webkit-backdrop-filter: blur(12px); }
  .group:hover img { will-change: transform; }
}
/* 音乐进度条滑块 */
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
  width: 12px; height: 12px; border-radius: 50%; background: #6366f1; cursor: pointer; }
/* Firefox backdrop-blur 兼容降级 */
@-moz-document url-prefix() { [class*="backdrop-blur-md"] { backdrop-filter: blur(8px) !important; } }
/* 滚动条美化：6px + indigo 30% 圆角 thumb；* { scrollbar-width: thin; } */
```

### 6.2 毛玻璃设计公式（全站统一，已观察）

```
bg-white/40 dark:bg-slate-800/50      ← 半透明卡片底色
backdrop-blur-md / backdrop-blur-xl   ← 背景模糊（卡片 md，覆盖层 xl）
border border-white/40 dark:border-white/10  ← 半透明边框
rounded-3xl（详情页用 rounded-[40px]）← 大圆角
shadow-xl / shadow-2xl                ← 阴影
transition-colors duration-700        ← 主题切换平滑
```

### 6.3 主题切换机制（已观察，自研实现）

```
ThemeProvider
├── useState(true)（默认 dark，防浅色闪屏）
├── 挂载后：localStorage.getItem('blog-theme')
│   ├── !== 'light' → 保持 dark，html.classList.add('dark')
│   └── 'light'     → setIsDark(false)，移除 .dark
├── 第二个 effect 监听 isDark 变化，同步 html class（防路由切换丢失）
├── toggleTheme()：反转 + localStorage.setItem('blog-theme', dark|light)
└── !mounted 时渲染 <div className="invisible"> 防闪屏
```

> ⚠️ `next-themes` 已安装但**从未被 import**，属冗余依赖，可移除。

### 6.4 字体策略（已观察，layout.tsx）

```typescript
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoSerif = Noto_Serif_SC({ subsets: ["latin"], weight: ["400","700","900"],
  variable: "--font-serif", display: 'swap' });
```

- 正文：Noto Serif SC（思源宋体，next/font/google 本地化，无外部请求）
- 代码：JetBrains Mono > Fira Code > Cascadia Code > monospace
- 标题：`font-black + tracking-tight/-0.02em`

### 6.5 代码高亮主题

- 详情页/关于页通过 `import 'highlight.js/styles/atom-one-dark.css'` 引入。
- 页面内 `<style>` 再覆盖 `.prose pre code .hljs-*` 全套 Atom One Dark token 色（comment `#5c6370`、keyword `#c678dd`、string `#98c379`、number `#d19a66`、title `#61aeee` 等）。

---

## 七、特效系统（已观察）

| 特效组件 | 技术 | 桌面端 | 移动端 | 说明 |
|----------|------|--------|--------|------|
| BackgroundSlider | CSS Transition | ✅ | ✅ | 仅在 `useGradient=false` 时渲染；图片轮播 + 渐变流动 |
| 渐变流动 | CSS Animation `gradientMove` | ✅ | ✅ | `background-size:400% 400%` + 15s infinite，layout 内联定义 keyframes |
| 白色遮罩 + 光晕 | backdrop-blur + blur | ✅ | ✅ | 移动端去掉 mix-blend-overlay 但仍保留 blur 光晕 |
| BackgroundEffects | 组合特效 | ✅ | ❌ `hidden md:block` | 内部 = Fireflies（暗色）+ Sakura（亮色）+ WindyGrass（常驻） |
| DanmakuBackground | CSS Animation | ✅ | ❌ `hidden md:block` | 15 条弹幕，容器 `fixed top-28 h-[30vh] z-0`，右→左 `float-left`，随机 top/duration/delay |
| Sakura/Fireflies/GlobalSnow/WindyGrass | CSS/Canvas | ✅ | ✅ | 低负载，移动端保留 |
| ClickEffect | CSS Animation | ✅ | ❌ `hidden md:block` | 点击波纹扩散 |
| SplashScreen | Framer Motion | ✅ | ✅ | 首次访问 2.2s |
| PageTransition | Framer Motion | ✅ | ✅ | 0.8s 上滑淡入 |
| WeatherEffect | CSS Animation | ✅ | ✅ | 天气特效（配合 WeatherWidget） |

> **性能分级原则**：高负载特效（Three.js 粒子、弹幕、点击波纹、浮动播放器、工具箱）全部 `hidden md:block` 桌面端独占；移动端只保留纯 CSS 轻特效 + 移动返回按钮。

---

## 八、状态管理（已观察）

项目不使用 Redux/Zustand，全部 React Context：

| Context | Provider | 消费者 | 存储内容 |
|---------|----------|--------|----------|
| ThemeContext | ThemeProvider | 全局 | `isDark`, `toggleTheme()` |
| MusicContext | MusicProvider | FloatingPlayer, MusicClient, CloudPlayer, LyricBar, SidebarLyric | 播放列表、当前歌、播放状态、进度、音量、静音、播放模式、歌词 |
| ToastContext | ToastProvider | ProfileCard 等 | `showToast(text, type)` |

数据流约定：服务端组件做数据获取 → props 传入客户端组件；客户端组件内部状态（useState/useRef/useEffect）只服务交互。

---

## 九、部署与发布

### 9.1 渲染与构建模式（已观察，`next.config.ts`）

```typescript
const nextConfig: NextConfig = {
  // output: 'export',          // 注释掉！纯静态导出会导致 API Routes 失效
  // trailingSlash: true,       // 注释掉
  images: { unoptimized: true },      // 禁用 Next 图片优化（外部图床 URL 直接 <img>）
  typescript: { ignoreBuildErrors: true },  // 忽略 TS 错误快速部署（生产可改 false）
};
```

- Vercel 部署为 **SSR 模式**：`generateStaticParams` 在构建时预渲染已存在文章；新文章 push 后自动重新构建预渲染。未预渲染的 slug 走动态渲染（fallback）。
- `images.unoptimized: true` 意味着全站用原生 `<img>`（源码确实全部 `<img>`），外部图床不会被 Vercel 图片优化服务处理——对图床外链是正确的。

### 9.2 Vercel 部署流程

```bash
git init && git add . && git commit -m "init blog"
git remote add origin git@github.com:LingLuoMuYun/EverlastingDemo.git
git push -u origin main
```

1. Vercel → Add New Project → Import 仓库 → Framework 自动识别 Next.js。
2. 配置环境变量：
   - `QWEATHER_KEY=xxx`（天气挂件，可选）
   - `NEXT_PUBLIC_GITALK_CLIENT_SECRET=xxx`（若按安全方案将 Gitalk secret 移出 siteConfig，可选）
3. Deploy。构建失败常见原因：缺 `posts/` 目录（不影响，代码已容错）、缺环境变量（仅对应功能报错）。

### 9.3 本地开发

```bash
cd XHBlogs
npm install
npm run dev          # http://localhost:3000
```

- 无需 Python、无需 FastAPI、无需管理端。
- `.env.local` 用于可选密钥（如天气 `QWEATHER_KEY`），且必须被 `.gitignore` 忽略。

### 9.4 内容更新工作流（去掉 CMS 后）

```
本地编辑
  ├── 写文章：posts/xxx.md
  ├── 写杂谈：chatters/xxx.md
  ├── 写说说：moments/moment-<时间戳>.md
  ├── 改配置：siteConfig.ts
  ├── 加友链/项目/相册：data/*.ts
  └── 改关于页：app/about/about.md
git add . && git commit -m "..." && git push
Vercel 自动构建部署（约 30s-2min）
```

---

## 十、渐进式实施路线

### 技能-实施步骤映射表（打通"技术分析 → 动手实现"）

| 实施步骤 | 对应的技术章节 | 核心文件 |
|----------|---------------|----------|
| 1 初始化项目 | §1.1 技术选型 / 附录 A | package.json, tsconfig, next.config, postcss |
| 2 全局样式 | §6.1 基础层 / §6.2 毛玻璃公式 | app/globals.css |
| 3 配置中心 | §3.1 siteConfig | siteConfig.ts |
| 4 数据层 | §3.2/§3.3 内容模型 | lib/*, data/*, posts/, chatters/, moments/ |
| 5 基础 Provider | §8 状态管理 / §6.3 主题 | ThemeProvider, ToastProvider, MusicProvider, SplashScreen |
| 6 全局布局 | §4.1 layout | app/layout.tsx + 背景/特效组件 |
| 7 导航骨架 | §4.2 Navbar / §4.8 工具组件 | Navbar, PageTransition, BackButton, MobileBackButton |
| 8 首页 | §4.3 首页布局 | app/page.tsx + ProfileCard, CloudPlayer, 轮播等 |
| 9 详情页 | §2.3 渲染管线 / §4.6 评论 | posts/[slug], chatter/[slug], lib/markdown.ts, Comments |
| 10 列表页 | §2.1 路由表 | moments, timeline, friends, projects, photowall, music, tree |
| 11 特效 | §7 特效系统 | BackgroundEffects, Danmaku 等 |
| 12 API 代理 | §5 API 层 | app/api/* |
| 13 部署 | §9 部署与发布 | Vercel + 环境变量 |

### 阶段一：最小可用（约 1-2 小时）

1. **复制目录**：从参考项目 `XinghuisamaBlogs/XHBlogs` 复制 `app/`、`components/`、`data/`、`posts/`、`chatters/`、`moments/`、`public/`、`siteConfig.ts` 及全部配置文件到本项目 EverlastingDemo 根目录。
2. **清理依赖**：用附录 A 的精简 `package.json` 替换原文件（去掉 Tiptap 13 件套、next-themes、openai、remark-html、remark）。
3. **创建内容目录**：`mkdir -p posts chatters moments data lib`。
4. **创建数据文件**：`data/albums.ts`、`data/friends.ts`、`data/projects.ts`（**必须带 interface 导出**，见 §3.3）。
5. **修改 siteConfig.ts**：title/authorName/bio/avatarUrl/faviconUrl、social、bgImages/themeColors、cloudMusicIds（可先 `[]`）、gitalkConfig（先留空）。（AI 猫猫的 geminiConfig 已删除，不需要）
6. **写第一篇文章** `posts/hello-world.md` + 创建 `app/about/about.md`（否则关于页显示"博主很懒"兜底文案）。
7. **本地验证**：`npm install && npm run dev`。
8. **部署**：GitHub push → Vercel（见 §9.2）。

### 阶段二：按需装配（每项 5-15 分钟）

使用功能矩阵（见审核报告优化版"第三部分"）：要评论 → 复制 Comments.tsx + app/api/github + 装 gitalk + 配 OAuth；要音乐 → 复制 MusicProvider/FloatingPlayer/CloudPlayer/LyricBar/SidebarLyric + app/music + api/music；等等。

### 阶段三：内容迁移与优化

迁移历史文章、配置友链/项目/相册、优化封面图（图床外链）、设置自定义域名（Vercel Domains + `public/CNAME`）。

### 阶段四：自定义增强

加 RSS（`app/feed.xml/route.ts`）、加统计（Umami/Plausible `<Script>`）、换评论（Waline/Giscus/Twikoo）、自定义主题色（`themeColors`）。

---

## 附录 A：精简依赖指南（已观察，基于真实 package.json）

```json
{
  "name": "everlasting-demo",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "eslint" },
  "dependencies": {
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "framer-motion": "^12.38.0",
    "gitalk": "^1.8.0",
    "gray-matter": "^4.0.3",
    "highlight.js": "^11.11.1",
    "katex": "^0.16.45",
    "lucide-react": "^1.7.0",
    "rehype-highlight": "^7.0.2",
    "rehype-katex": "^7.0.1",
    "rehype-stringify": "^10.0.1",
    "remark-gfm": "^4.0.1",
    "remark-math": "^6.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.1.2",
    "three": "^0.184.0",
    "@react-three/fiber": "^9.6.1",
    "@react-three/drei": "^10.7.7",
    "unified": "^11.0.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@tailwindcss/typography": "^0.5.19",
    "tailwindcss": "^4",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1"
  }
}
```

按需裁减：

| 不需要的功能 | 移除依赖 |
|-------------|----------|
| 3D 粒子/灵境 3D 模型 | `three`、`@react-three/fiber`、`@react-three/drei` |
| 评论 | `gitalk`（同时删 app/api/github + Comments 调用） |
| 音乐 | 保留 framer-motion/lucide-react（其他组件也依赖），仅删页面与组件 |
| 全部保留但砍体积 | 可去掉 `@tailwindcss/typography`（仅 prose 排版用，若保留详情页样式则建议保留） |

> ⚠️ 不要移除 `lucide-react`：MobileBackButton、MusicClient、tree 系列、GlobalToolbox、CalculatorTool 均使用。

---

## 附录 B：关键文件依赖关系图（已观察）

```
siteConfig.ts ─────────────────────────────────────────────┐
   ├── layout.tsx (title/bio/favicon/bgImages/themeColors) │
   ├── page.tsx (defaultPostCover/photoWallImage)          │
   ├── Navbar.tsx (navTitle/navSuffix/navAfter)            │
   ├── ProfileCard.tsx (authorName/bio/social)             │
   ├── SiteDashboard.tsx (buildDate/footerBadges/icp)      │
   ├── MusicProvider.tsx (cloudMusicIds)                   │
   ├── Comments.tsx (gitalkConfig)                         │
   ├── DanmakuBackground.tsx (danmakuList)                 │
   ├── SplashScreen.tsx (avatarUrl/authorName)             │
   ├── AboutClient/CreativeWorkshopClient (enableLevelSystem/friendLinkApplyFormat)
   └── 各页面 metadata (title)                             │
                                                           │
posts/*.md ────────────────────────────────────────────────┤
   ├── page.tsx (首页文章列表/轮播)                          │
   ├── posts/[slug]/page.tsx (详情)                         │
   ├── timeline/page.tsx (归档)                             │
   ├── about/page.tsx (活动时间线)                          │
   ├── tree/page.tsx (灵境卡片)                             │
   └── SearchBar.tsx (搜索数据源)                           │
                                                           │
data/*.ts ─────────────────────────────────────────────────┤
   ├── albums.ts → photowall/PhotoWallClient + page.tsx    │
   ├── friends.ts → friends/FriendsBoard                   │
   └── projects.ts → projects/ProjectsBoard                │
```

---

## 附录 C：v1.0 勘误对照表（本轮优化修正项）

| # | 位置 | v1.0 描述 | 源码事实（已观察） |
|---|------|-----------|--------------------|
| 1 | §4.3 首页 | 有"照片墙/友链/项目"三张卡片网格 | 实际为照片墙大海报 + 说说轮播 + 主题切换块，友链/项目无首页卡片 |
| 3 | §3.1 siteConfig | `google` 注释"实际上是 mailto:" | XHBlogs 前端 SocialBtn 渲染为普通 `<a href>`；留空则不渲染 |
| 4 | §4.4 音乐 | "首页时 opacity:0 隐藏但不销毁" | 对 FloatingPlayer 成立；另首页有常驻 CloudPlayer 卡片（v1.0 未描述） |
| 5 | §4.1 layout | 未区分移动端 | FloatingPlayer/GlobalToolbox/ClickEffect/Danmaku/BackgroundEffects 全部 `hidden md:block` 桌面端独占 |
| 6 | §2.1 路由 | `/tree` = 目录树浏览 | 实为灵境创意工坊（AlchemyLab 等级系统 + DijiangModel 3D 模型） |
| 7 | 附录 A | "lucide-react 如仅被音乐页使用可移除" | 被 5+ 个组件使用，不可移除 |
| 8 | §3.2 Frontmatter | date 仅 `YYYY-MM-DD` | 首页 `formatUpdateTime` 兼容带时间格式 |
| 9 | §9.1 部署 | 未提 `typescript.ignoreBuildErrors` | next.config 实际为 true |
| 10 | 阶段一 | 未提 `app/about/about.md` | 关于页数据源，缺失时走"博主很懒"兜底 |

---

> **文档版本**：v2.1（优化版 · EverlastingDemo） | **复核方式**：逐文件对照源码 | **复核时间**：2026-08-04
> **关联文档**：`EverlastingDemo-审核报告与优化实现计划-优化版.md`（四轮审核 + 修复方案）、`EverlastingDemo-可复现高还原项目实现指南.md`（0-1 整合版）
