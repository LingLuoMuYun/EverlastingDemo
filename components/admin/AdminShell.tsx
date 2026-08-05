"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard,
  FileText,
  Music2,
  Link: LinkIcon,
  FolderKanban,
  Images,
  Settings,
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-white/30 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm">
        <div className="mx-auto w-[94%] max-w-6xl h-14 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="shrink-0 font-black tracking-tight text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            管理后台
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {ADMIN_MODULES.map((m) => {
              const Icon = ICONS[m.icon];
              const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
              if (m.disabled) {
                return (
                  <span
                    key={m.key}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70"
                    title={`${m.description}（规划中）`}
                  >
                    {Icon && <Icon size={13} />}
                    {m.title}
                  </span>
                );
              }
              return (
                <Link
                  key={m.key}
                  href={m.href}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-black transition-all ${
                    active
                      ? "bg-indigo-500 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {Icon && <Icon size={13} />}
                  {m.title}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/"
            className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            返回站点 →
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full mx-auto max-w-6xl px-4 sm:px-6 py-6 md:py-8 relative z-10">
        {children}
      </main>
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
