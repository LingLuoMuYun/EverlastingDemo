import Link from "next/link";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  FileText,
  Music2,
  Link as LinkIcon,
  FolderKanban,
  Images,
  Settings,
} from "lucide-react";
import { ADMIN_MODULES } from "../../lib/admin";
import { getAllNotesMeta } from "../../lib/notes";
import { getLibrary } from "../../lib/music";
import { getPhotoLibrary } from "../../lib/photos";
import { getProjects } from "../../lib/projects";
import { getFriends } from "../../lib/friends";
import { getSiteConfig } from "../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "管理后台 | " + siteConfig.title,
};

const ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard,
  FileText,
  Music2,
  Link: LinkIcon,
  FolderKanban,
  Images,
  Settings,
};

export default function AdminDashboardPage() {
  const counts: Record<string, number> = {
    notes: getAllNotesMeta({ includeDraft: true }).length,
    music: getLibrary().tracks.length,
    photos: getPhotoLibrary().albums.reduce((n, a) => n + a.photos.length, 0),
    projects: getProjects().projects.length,
    friends: getFriends().friends.length,
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">管理后台</h1>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
          仅本地开发可用；保存后自动 git commit + push 发布
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {ADMIN_MODULES.filter((m) => !m.disabled).map((m) => {
          const Icon = ICONS[m.icon];
          return (
            <Link
              key={m.key}
              href={m.href}
              className="group rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 md:p-6 transition-all hover:scale-[1.02] hover:shadow-xl hover:border-indigo-500/40"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 flex items-center justify-center text-indigo-500">
                  {Icon && <Icon size={20} />}
                </div>
                {counts[m.key] !== undefined && (
                  <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                    {counts[m.key]}
                  </span>
                )}
              </div>
              <h2 className="font-black text-slate-900 dark:text-white mb-1">{m.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{m.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 p-5 md:p-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        规划中模块：站点配置（见导航灰显项）。新增后台模块只需在{" "}
        <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">lib/admin.ts</code> 注册一行并新建页面。
      </div>
    </div>
  );
}
