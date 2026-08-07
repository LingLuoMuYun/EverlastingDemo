"use client";

import { useMemo } from "react";
import {
  Flame,
  Clock3,
  CheckCircle2,
  Download,
  ChartPie,
  BarChart3,
} from "lucide-react";
import { useTheme } from "../ThemeProvider";
import EChart from "./EChart";
import {
  buildFocusBarOption,
  buildStatusPieOption,
} from "./chartOptions";
import type { DailyStats, PomodoroState, TodoItem } from "./types";
import { dateKeyOfTs, todayKey } from "./storage";

interface StatsPanelProps {
  stats: DailyStats[];
  todos: TodoItem[];
  pomodoroState: PomodoroState;
  onExport: () => void;
}

export default function StatsPanel({
  stats,
  todos,
  pomodoroState,
  onExport,
}: StatsPanelProps) {
  const { isDark } = useTheme();

  const barOption = useMemo(
    () => buildFocusBarOption(stats, isDark),
    [stats, isDark]
  );

  const { completed, active, todayCompleted, focusMinutes } = useMemo(() => {
    const done = todos.filter((t) => t.completed);
    const today = todayKey();
    return {
      completed: done.length,
      active: todos.length - done.length,
      todayCompleted: done.filter(
        (t) => t.completedAt && dateKeyOfTs(t.completedAt) === today
      ).length,
      focusMinutes: Math.round(pomodoroState.focusSeconds / 60),
    };
  }, [todos, pomodoroState.focusSeconds]);

  const pieOption = useMemo(
    () => buildStatusPieOption(completed, active, isDark),
    [completed, active, isDark]
  );

  const items = [
    {
      icon: Clock3,
      label: "今日专注",
      value: `${focusMinutes} 分钟`,
      color: "text-indigo-500",
      bg: "bg-indigo-500/15",
    },
    {
      icon: Flame,
      label: "今日番茄",
      value: `${pomodoroState.completedFocus} 个`,
      color: "text-orange-500",
      bg: "bg-orange-500/15",
    },
    {
      icon: CheckCircle2,
      label: "今日完成",
      value: `${todayCompleted} 项`,
      color: "text-emerald-500",
      bg: "bg-emerald-500/15",
    },
  ];

  return (
    <section className="rounded-3xl backdrop-blur-md border shadow-xl p-6 bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white">
              专注统计
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              今日概览与近 7 日趋势
            </p>
          </div>
        </div>
        <button
          onClick={onExport}
          className="h-9 px-4 rounded-full bg-white/50 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center gap-1.5 transition-all"
          title="导出全部工具箱数据为 JSON"
        >
          <Download className="w-3.5 h-3.5" />
          导出数据
        </button>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 p-3 text-center"
          >
            <span
              className={`inline-flex w-8 h-8 rounded-xl ${item.bg} ${item.color} items-center justify-center mb-1.5`}
            >
              <item.icon className="w-4 h-4" />
            </span>
            <p className="text-sm font-black text-slate-800 dark:text-white tabular-nums">
              {item.value}
            </p>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 p-4 mb-4">
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          近 7 日专注（分钟）
        </h3>
        <EChart option={barOption} className="h-40 w-full" />
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 p-4">
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
          <ChartPie className="w-4 h-4 text-indigo-500" />
          任务完成情况
        </h3>
        {todos.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 font-medium">
            暂无任务数据，先去 TodoList 添加任务吧
          </div>
        ) : (
          <EChart option={pieOption} className="h-52 w-full" />
        )}
      </div>
    </section>
  );
}
