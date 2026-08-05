# EverlastingDemo

泠落的个人博客 —— 基于 **Next.js 16 + React 19 + Tailwind CSS v4** 的高颜值毛玻璃（Glassmorphism）风格站点。

内容采用"文件即内容"模式：文章 / 杂谈 / 说说统一存放在 `notes/*.md`，无数据库；写作支持**手改 Markdown** 与**本地编辑器**双路径，修改后 `git push` 即自动部署（GitHub + Vercel）。

## ✨ 功能特性

- 🧭 **统一「杂谈」内容模块**：文章（`article`）/ 杂谈（`talk`）/ 说说（`moment`）三合一，`/notes` 列表按类型 Tab 筛选 + 搜索 + 标签过滤，详情页按类型渲染（文章 TOC、杂谈心情、说说定位/图片灯箱）
- ✏️ **统一管理后台**：`/admin` 聚合笔记编辑器（`/admin/notes`，原 `/editor*` 301）与音乐曲库管理（`/admin/music`：本地音频上传 + 网易云 ID/歌单导入 + 歌单分组/标签/批量管理）；笔记双栏写作（Markdown 源码 + 实时预览）、草稿、自动保存、Ctrl+S、slug 自动生成、冲突检测、图片栏（文件选择/粘贴/拖拽上传），保存后自动推送 GitHub
- 🎨 毛玻璃设计系统 + 暗/亮主题 + 流动渐变背景
- 🎵 网易云音乐播放器（云播放、歌词、黑胶动画）
- ❄️ 和风天气挂件 + 天气特效
- 📷 照片墙（相册 + 灯箱）、项目展示、归档时间线、关于页（含友链 Tab）
- 🔍 全站搜索（覆盖全部笔记）
- 🧹 内容统一：仅保留 `/notes` 单一内容模块（旧 `posts/` `chatters/` `moments/` 目录与旧路由已删除）

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript 5 |
| 样式 | Tailwind CSS v4 + @tailwindcss/typography |
| 内容 | gray-matter + unified / remark / rehype（GFM、KaTeX、highlight.js） |
| 动画 | Framer Motion |
| 图标 | lucide-react |
| 部署 | GitHub + Vercel（SSR / SSG） |

## 🚀 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

可选环境变量（复制 `.env.example` 为 `.env.local`）：

| 变量 | 说明 |
|------|------|
| `QWEATHER_KEY` | 和风天气密钥（天气挂件，可选） |
| `EDITOR_TOKEN` | 本地编辑器鉴权（可选；开启后请求需带 `Authorization: Bearer <token>`） |
| `AUTO_PUSH` | 本地编辑器保存后自动 `git commit + push`（默认开；置 `0` 关闭；生产始终关闭） |
| `MUSIC_MAX_MB` | 音乐管理本地音频上传大小上限（MB，默认 50） |
| `MUSIC_COMMIT_FILES` | 音乐管理本地音频是否随 git 提交（默认 `1` 入库；置 `0` 不入库，生产需另行上传） |

## ✍️ 写作：内容模型

所有内容统一存放在 `notes/*.md`，文件名即 slug（仅小写字母/数字/中划线），类型由 frontmatter `kind` 区分：

```markdown
---
kind: article          # article=文章 / talk=杂谈 / moment=说说
title: "你好，世界"
date: 2026-08-04 22:30
updated: 2026-08-05 10:00  # 编辑器保存时自动更新
description: "摘要（可选，缺省取正文前 100 字）"
cover: https://...          # 封面（可选）
tags: [博客, 开始]          # 可选
mood: "开心"                # 杂谈/说说 可选
location: "北京"            # 说说 可选
draft: false                # true = 前台不可见（草稿）
---

正文 Markdown...
```

**两种写作方式（结果完全等价）**：

1. **手改 Markdown**：直接编辑 `notes/` 下的 `.md` 文件；
2. **本地编辑器**：`npm run dev` 后打开统一管理后台 `/admin`（笔记入口 `/admin/notes`，原 `/editor*` 自动 301），新建/编辑/删除笔记，保存即写回 `notes/*.md`。
   - 保存后会自动 `git commit + push` 到 GitHub（可用 `AUTO_PUSH=0` 关闭），发布即完成。
   - 图片栏支持从文件管理器选择、拖拽、或直接 `Ctrl+V` 粘贴截图，图片自动存到 `public/uploads/notes/` 并随推送发布。

发布流程：`git add . && git commit -m "更新笔记" && git push` → Vercel 自动构建部署。

> ⚠️ 管理后台仅本地开发可用：Vercel 生产环境文件系统只读，线上 `/admin*` 会显示只读提示。

## 🗺 路由一览

| 路由 | 说明 |
|------|------|
| `/` | 首页（个人名片、笔记轮播、最新动态、照片墙、音乐、天气） |
| `/notes` | 「杂谈」统一列表（kind Tab + 搜索 + 标签） |
| `/notes/[slug]` | 笔记详情（按 kind 条件渲染） |
| `/admin` `/admin/notes` `/admin/music` | 统一管理后台（仅本地）：总览 / 笔记（原 `/editor*` 301）/ 音乐曲库管理 |
| `/api/notes` `/api/notes/render` | 编辑器读写接口（生产只读） |
| `/timeline` | 归档（年月 + 标签 + kind 筛选） |
| `/photowall` `/music` `/projects` `/about` | 照片墙 / 音乐 / 项目 / 关于（自我介绍 / 研究动态 / 友链） |

旧路由 `/posts/*`、`/chatter*`、`/moments` 已删除，404 由统一 404 页兜底；所有内容统一在 `/notes`。友链模块已并入关于页（`/about?tab=friends`），旧入口 `/friends` 301 跳转。

## 📦 常用命令

```bash
npm run dev                 # 本地开发
npm run build               # 生产构建
npm run start               # 生产运行
npm run lint                # 代码检查
node scripts/validate-notes.mjs            # 校验 notes/ frontmatter
node scripts/validate-music.mjs            # 校验 data/music/library.json 结构与本地文件
node scripts/migrate-notes.mjs --dry-run   # 旧目录（posts/chatters/moments）迁移预演
node scripts/migrate-notes.mjs             # 执行迁移（幂等）
```

## ☁️ 部署

1. 推送到 GitHub 仓库 `LingLuoMuYun/EverlastingDemo`；
2. Vercel → Import 仓库 → Framework 自动识别 Next.js；
3. 配置环境变量（`QWEATHER_KEY` 可选）；
4. Deploy；之后每次 `git push` 自动重新构建。

渲染说明：`/notes/[slug]` 使用 `generateStaticParams` 构建期预渲染；新增笔记需重新构建（push 触发）后上线。

## 📚 文档索引

技术文档位于 `docs/exp/`：

| 文档 | 说明 |
|------|------|
| [内容整合企划书](docs/exp/EverlastingDemo-内容整合企划书-杂谈统一模块.md) | 「杂谈」统一内容模块 + 本地编辑器的完整方案（含实施状态） |
| [统一管理后台与音乐模块优化实现策略](docs/exp/EverlastingDemo-统一管理后台与音乐模块优化实现策略.md) | 统一 `/admin` 后台（笔记+音乐模块）+ 音乐曲库管理 + 播放器优化 + 音量键调试专项 |
| [可复现高还原项目实现指南](docs/exp/EverlastingDemo-可复现高还原项目实现指南.md) | 从 0 到 1 搭建指南（0-6 阶段） |
| [独立前端实现策略技术文档](docs/exp/EverlastingDemo-独立前端实现策略技术文档-优化版.md) | 技术蓝图（路由、内容模型、API、样式系统） |
| [审核报告与优化实现计划](docs/exp/EverlastingDemo-审核报告与优化实现计划-优化版.md) | 多轮源码复核与优化计划 |
| [XHBlogs 项目分析指南](docs/exp/XHBlogs-项目分析指南.md) | 参考项目 XHBlogs 的历史分析 |

## 📝 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| init | 2026-08-04 | EverlastingDemo 初始化（Next.js 16 + React 19 + Tailwind v4） |
| 0.2.0 | 2026-08-05 | 内容整合：统一「杂谈」模块（notes/ + kind）、本地编辑器、旧路由 301、音乐/天气组件 |
| 0.3.0 | 2026-08-05 | 深链（/notes?kind=、/timeline?kind=&tag=）；删除旧目录/旧路由与 301；修复图床防盗链图片不显示；编辑器本地图片上传 |
| 0.4.0 | 2026-08-05 | 编辑器：新建默认当前本地时间 + 「现在」按钮；图片栏（选择/粘贴/拖拽/缩略图插入）；保存后自动推送 GitHub |
