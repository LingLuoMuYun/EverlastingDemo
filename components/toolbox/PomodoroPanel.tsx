"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  Bell,
  Square,
} from "lucide-react";
import { useToast } from "../ToastProvider";
import type { TodoItem, PomodoroMode } from "./types";
import type { UsePomodoroReturn } from "./usePomodoro";
import { formatMs } from "./usePomodoro";

const MODE_TABS: {
  key: PomodoroMode;
  label: string;
  active: string;
  ring: string;
  glow: string;
}[] = [
  {
    key: "focus",
    label: "专注",
    active: "bg-indigo-500 text-white border-indigo-500 shadow-indigo-500/40",
    ring: "text-indigo-500",
    glow: "shadow-[0_0_40px_rgba(99,102,241,0.35)]",
  },
  {
    key: "shortBreak",
    label: "短休",
    active: "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/40",
    ring: "text-emerald-500",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.35)]",
  },
  {
    key: "longBreak",
    label: "长休",
    active: "bg-sky-500 text-white border-sky-500 shadow-sky-500/40",
    ring: "text-sky-500",
    glow: "shadow-[0_0_40px_rgba(14,165,233,0.35)]",
  },
];

const MODE_LABEL: Record<PomodoroMode, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};

interface PomodoroPanelProps {
  api: UsePomodoroReturn;
  todos: TodoItem[];
}

export default function PomodoroPanel({
  api,
  todos,
}: PomodoroPanelProps) {
  const {
    state,
    settings,
    updateSettings,
    remainingMs,
    totalMs,
    progress,
    start,
    pause,
    reset,
    switchMode,
    skip,
    finish,
    setCurrentTodo,
  } = api;

  const { showToast } = useToast();
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const activeTodos = todos.filter((t) => !t.completed);
  const currentTodo = todos.find((t) => t.id === state.currentTodoId);
  const currentTab = MODE_TABS.find((m) => m.key === state.mode)!;
  const canFinish = state.running || remainingMs < totalMs;
  const R = 84;
  const C = 2 * Math.PI * R;

  const setMinutes = (key: keyof typeof settings, value: number) => {
    const v = Math.min(120, Math.max(1, Math.round(value) || 1));
    updateSettings({ [key]: v } as Partial<typeof settings>);
  };

  const setBreakInterval = (value: number) => {
    const v = Math.min(12, Math.max(1, Math.round(value) || 1));
    updateSettings({ longBreakInterval: v });
  };

  const handleRequestNotification = async () => {
    if (!("Notification" in window)) {
      showToast("当前浏览器不支持系统通知", "warning");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === "granted") {
        showToast("通知已开启，专注完成时会提醒你", "success");
      } else if (perm === "denied") {
        showToast("通知被拒绝，可在浏览器设置中重新允许", "warning");
      } else {
        showToast("未获得通知权限，仍会使用页面标题提醒", "info");
      }
    } catch {
      showToast("请求通知权限失败", "warning");
    }
  };

  return (
    <section className="rounded-3xl backdrop-blur-md border shadow-xl p-6 bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50">
      <header className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Timer className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">
            番茄钟
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            专注 · 休息 · 节奏由你掌控
          </p>
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        {MODE_TABS.map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            className={`flex-1 h-9 rounded-full border text-sm font-bold transition-all ${
              state.mode === m.key
                ? `${m.active} shadow-lg`
                : "bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/10"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className={`relative w-56 h-56 rounded-full ${currentTab.glow}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-slate-200 dark:stroke-slate-700"
            />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className={`${currentTab.ring} transition-[stroke-dashoffset] duration-300`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-5xl font-black tabular-nums ${currentTab.ring}`}
            >
              {formatMs(remainingMs)}
            </span>
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2">
              {state.running ? `${MODE_LABEL[state.mode]}中` : "待开始"}
              {currentTodo ? ` · ${currentTodo.title}` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={skip}
          className="w-11 h-11 rounded-full bg-white/50 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all"
          title="跳过当前阶段"
        >
          <SkipForward className="w-5 h-5" />
        </button>
        <button
          onClick={state.running ? pause : start}
          className={`h-14 px-8 rounded-full text-white font-black text-base flex items-center gap-2 transition-all active:scale-95 shadow-lg ${
            state.running
              ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/40"
              : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/40"
          }`}
        >
          {state.running ? (
            <>
              <Pause className="w-5 h-5" />
              暂停
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              开始
            </>
          )}
        </button>
        <button
          onClick={reset}
          className="w-11 h-11 rounded-full bg-white/50 dark:bg-slate-900/50 border border-white/60 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all"
          title="重置"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={finish}
          disabled={!canFinish}
          className={`h-11 px-5 rounded-full text-white font-bold text-sm flex items-center gap-1.5 transition-all active:scale-95 ${
            canFinish
              ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/40"
              : "bg-slate-300 dark:bg-slate-700 text-slate-100 dark:text-slate-300 cursor-not-allowed shadow-none"
          }`}
          title="立即结束当前阶段（专注会记为已完成并计入统计）"
        >
          <Square className="w-4 h-4" />
          结束
        </button>
      </div>

      <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              专注（分钟）
            </span>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.focusMinutes}
              onChange={(e) => setMinutes("focusMinutes", Number(e.target.value))}
              className="h-9 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              短休（分钟）
            </span>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.shortBreakMinutes}
              onChange={(e) =>
                setMinutes("shortBreakMinutes", Number(e.target.value))
              }
              className="h-9 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              长休（分钟）
            </span>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.longBreakMinutes}
              onChange={(e) =>
                setMinutes("longBreakMinutes", Number(e.target.value))
              }
              className="h-9 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              长休间隔（个）
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={settings.longBreakInterval}
              onChange={(e) => setBreakInterval(Number(e.target.value))}
              className="h-9 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            <button
              type="button"
              onClick={() => updateSettings({ autoSwitch: !settings.autoSwitch })}
              className={`w-9 h-5 rounded-full transition-colors ${
                settings.autoSwitch ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  settings.autoSwitch ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            自动切换
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            <button
              type="button"
              onClick={() => updateSettings({ sound: !settings.sound })}
              className={`w-9 h-5 rounded-full transition-colors ${
                settings.sound ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  settings.sound ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            提示音
          </label>

          <button
            type="button"
            onClick={handleRequestNotification}
            disabled={
              notifPerm === "granted" ||
              notifPerm === "denied" ||
              notifPerm === "unsupported"
            }
            className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
              notifPerm === "granted"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : notifPerm === "denied"
                  ? "bg-red-500/10 text-red-500 border-red-500/30 opacity-70 cursor-not-allowed"
                  : "bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-500 hover:bg-indigo-500/10"
            }`}
            title={
              notifPerm === "granted"
                ? "系统通知已开启"
                : notifPerm === "denied"
                  ? "通知被拒绝，请在浏览器设置中允许"
                  : "开启系统通知，专注完成时在浏览器外也能收到提醒"
            }
          >
            <Bell className="w-3.5 h-3.5" />
            {notifPerm === "granted"
              ? "通知已开启"
              : notifPerm === "denied"
                ? "通知被拒绝"
                : "开启通知"}
          </button>

          <select
            value={state.currentTodoId ?? ""}
            onChange={(e) => setCurrentTodo(e.target.value || undefined)}
            className="h-9 px-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 max-w-[220px]"
            title="关联任务"
          >
            <option value="">未关联任务</option>
            {activeTodos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
