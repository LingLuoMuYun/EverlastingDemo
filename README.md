# EverlastingDemo · 泠落的小屋

一个"文件即内容"的个人博客 / 个人主页 —— 高颜值毛玻璃（Glassmorphism）设计，文章、杂谈、音乐、照片、时间线一站式呈现。

基于 **Next.js 16 + React 19 + Tailwind CSS v4** 构建；所有内容都是仓库里的 Markdown / JSON 文件，没有数据库。写作、改版、发布全部通过 Git 完成。

## ✨ 功能亮点

**📝 统一内容体系（文章 / 杂谈）**

- 全部内容以 `notes/*.md` 文件存储，frontmatter 区分「文章」与「杂谈」，文件名即 slug
- `/notes` 列表支持类型 Tab、搜索、标签过滤；详情页按类型差异化渲染（文章自动生成目录 TOC，杂谈展示心情 / 定位）
- 支持 GFM、KaTeX 数学公式、代码高亮，并自动处理外链图床防盗链

**🛠 本地管理后台（Git 即 CMS）**

- 双栏写作：Markdown 源码 + 实时预览，草稿自动保存、Ctrl+S、slug 自动生成、mtime 冲突检测
- 图片一键上传：文件选择 / 拖拽 / Ctrl+V 粘贴截图，自动存入 `public/uploads/notes/`
- 保存后自动 `git commit + push`，发布即完成；可用 `AUTO_PUSH=0` 关闭
- 后台还覆盖音乐曲库、照片、项目、友链的管理

**🎵 云音乐播放器**

- 网易云音乐接入：单曲 / 歌单导入（自动抓取歌词并去重入库），也支持本地音频上传
- 黑胶唱片旋转动画、逐字歌词、浮动迷你播放器、Media Session 系统媒体控制
- 音量精细化：滚轮调节 + Shift 微调 + 快捷键，百分比显示并持久化

**🏠 个人主页其余模块**

- 照片墙（相册 + 灯箱预览）、项目展示、归档时间线（年月 / 标签 / 类型筛选）、友链
- 和风天气挂件 + 天气特效、暗 / 亮主题、流动渐变 / 图片背景、页面切换动画

## 🛠 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript 5 |
| 样式 | Tailwind CSS v4 + @tailwindcss/typography |
| 内容 | gray-matter + unified / remark / rehype |
| 动画 | Framer Motion |
| 图标 | lucide-react |
| 部署 | GitHub + Vercel（静态预渲染 SSG） |

## 🚀 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

可选环境变量见 `.env.example`（天气密钥、编辑器鉴权、自动推送开关等）。

## 🧱 项目结构

```text
app/           # 页面与 API 路由（notes / admin / music / photowall / timeline ...）
components/    # UI 组件（播放器、编辑器、照片墙、天气等）
lib/           # 核心逻辑（笔记读写、Markdown 渲染、网易云导入、自动推送）
data/          # 静态数据（音乐曲库、相册、项目、友链）
notes/*.md     # 全部文章与杂谈，文件名即 slug
scripts/       # 校验 / 迁移工具脚本
```

## 💡 实现细节

**文件即内容，Git 即 CMS**

- 全站无数据库：笔记是 `notes/*.md`，音乐 / 照片 / 项目 / 友链是 `data/` 下的 JSON
- 前台读取带 60s TTL 缓存，编辑器保存后主动失效；`notes/[slug]` 使用 `generateStaticParams` 构建期预渲染，配合 `generateMetadata` 输出 SEO 元信息
- 自动推送模块串行化执行 `git add → commit → push`，只提交任务相关目录，避免并发保存时的 `index.lock` 冲突

**Markdown 渲染管线**

- unified + remark / rehype 插件链：GFM 表格 / 任务列表、KaTeX 公式、highlight.js 代码高亮
- 自定义预处理：统一换行、数字列表补空格、代码块保护、正文空行转 `<br>`
- 内置 rehype 插件为所有外链图片加 `referrerPolicy="no-referrer"`，解决图床防盗链不显示问题

**编辑器体验**

- 防抖自动保存草稿到 localStorage，刷新不丢稿；保存成功即清理
- 通过文件 mtime 检测多人 / 多端编辑冲突，避免互相覆盖
- 图片上传接口将截图 / 拖拽文件落盘到 `public/uploads/notes/` 并在光标处插入 Markdown

**音乐系统**

- 网易云歌单导入：逐首抓取歌词（LRC / 翻译），按网易云 ID 去重，支持自定义标签与歌单分组
- 播放器支持缓冲进度、播放列表、上一首 / 下一首、滚动 / 快捷键调音量，并接入系统 Media Session

## ☁️ 部署

推送到 GitHub 后由 Vercel 自动构建部署，每次 `git push` 即触发更新。管理后台仅本地开发可用（生产环境文件系统只读，会显示只读提示）。
