// lib/admin.ts —— 统一管理后台模块注册表
// 新增模块：在这里加一行 + 建一个 app/admin/ 下的页面，AdminShell 自动生成导航
export interface AdminModule {
  key: string;
  title: string;
  href: string;
  icon: string; // lucide-react 图标名
  description: string;
  stage: 1 | 2 | 3; // 一期/二期/规划
  disabled?: boolean; // 占位展示，不可点击
}

export const ADMIN_MODULES: AdminModule[] = [
  {
    key: "dashboard",
    title: "总览",
    href: "/admin",
    icon: "LayoutDashboard",
    description: "后台入口与状态",
    stage: 1,
  },
  {
    key: "notes",
    title: "笔记",
    href: "/admin/notes",
    icon: "FileText",
    description: "notes/*.md 增删改与自动推送",
    stage: 1,
  },
  {
    key: "music",
    title: "音乐",
    href: "/admin/music",
    icon: "Music2",
    description: "本地音频与网易云 ID 曲库",
    stage: 1,
  },
  {
    key: "friends",
    title: "友链",
    href: "/admin/friends",
    icon: "Link",
    description: "友链数据维护",
    stage: 2,
    disabled: true,
  },
  {
    key: "projects",
    title: "项目",
    href: "/admin/projects",
    icon: "FolderKanban",
    description: "项目数据维护",
    stage: 2,
    disabled: true,
  },
  {
    key: "photos",
    title: "相册",
    href: "/admin/photos",
    icon: "Images",
    description: "照片墙上传与排序",
    stage: 2,
    disabled: true,
  },
  {
    key: "settings",
    title: "站点配置",
    href: "/admin/settings",
    icon: "Settings",
    description: "siteConfig 只读展示",
    stage: 3,
    disabled: true,
  },
];
