"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ListTodo,
  Timer,
  ArrowRight,
  Clock3,
  CheckCircle2,
  Flame,
  ListChecks,
} from "lucide-react";
import { useToolboxData } from "../../components/toolbox/useToolboxData";

interface ToolCardProps {
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  subtitle: string;
  description: string;
  stats: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number | string | null;
  }[];
}

function ToolCard({
  href,
  icon: Icon,
  iconClass,
  title,
  subtitle,
  description,
  stats,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group relative rounded-3xl backdrop-blur-md border shadow-xl p-8 bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 flex flex-col"
    >
      <div className="flex items-center gap-4 mb-5">
        <span
          className={`w-14 h-14 rounded-2xl ${iconClass} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className="w-7 h-7" />
        </span>
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">
            {title}
          </h2>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 flex-1">
        {description}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 p-3 text-center"
          >
            <p className="text-lg font-black text-slate-800 dark:text-white tabular-nums">
              {s.value === null ? "—" : s.value}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <s.icon className="w-3 h-3" />
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <span className="inline-flex items-center gap-2 text-sm font-black text-indigo-600 dark:text-indigo-400 group-hover:gap-3 transition-all">
        进入工具
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

export default function ToolboxHub() {
  const { data } = useToolboxData();

  const activeCount = data
    ? data.todos.filter((t) => !t.completed).length
    : null;
  const completedCount =
    data && activeCount !== null ? data.todos.length - activeCount : null;
  const todayFocus = data ? data.pomodoro.state.completedFocus : null;
  const focusMinutes = data
    ? Math.round(data.pomodoro.state.focusSeconds / 60)
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
          工具箱
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
          轻量效率工具集 · 选择一个工具开始
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
        <ToolCard
          href="/toolbox/todos"
          icon={ListTodo}
          iconClass="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          title="TodoList"
          subtitle="待办清单"
          description="管理每日任务：优先级、标签、截止日期与进度追踪，支持搜索与多种排序。"
          stats={[
            {
              icon: ListChecks,
              label: "进行中",
              value: activeCount,
            },
            {
              icon: CheckCircle2,
              label: "已完成",
              value: completedCount,
            },
          ]}
        />
        <ToolCard
          href="/toolbox/pomodoro"
          icon={Timer}
          iconClass="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          title="番茄钟"
          subtitle="专注计时"
          description="专注 / 短休 / 长休自由配置，结束时提醒，自动累计今日专注统计。"
          stats={[
            {
              icon: Flame,
              label: "今日番茄",
              value: todayFocus,
            },
            {
              icon: Clock3,
              label: "今日专注",
              value:
                focusMinutes === null ? null : `${focusMinutes} 分钟`,
            },
          ]}
        />
      </div>
    </div>
  );
}
