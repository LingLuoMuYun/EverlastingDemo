"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { useTodos } from "../../components/toolbox/useTodos";
import { usePomodoro } from "../../components/toolbox/usePomodoro";
import TodoPanel from "../../components/toolbox/TodoPanel";
import PomodoroPanel from "../../components/toolbox/PomodoroPanel";
import StatsPanel from "../../components/toolbox/StatsPanel";
import {
  loadToolboxData,
  normalizeDay,
  saveToolboxData,
  todayKey,
} from "../../components/toolbox/storage";
import type { ToolboxData } from "../../components/toolbox/types";

function playFinishSound(enable: boolean) {
  if (!enable) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
  } catch {
    // 音效失败静默
  }
}

function flashTitle(text: string) {
  try {
    const original = document.title;
    document.title = text;
    window.setTimeout(() => {
      document.title = original;
    }, 5000);
  } catch {
    // 静默
  }
}

function maybeNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // 静默
  }
}

export default function ToolboxClient() {
  const [data, setData] = useState<ToolboxData | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const loaded = normalizeDay(loadToolboxData());
    saveToolboxData(loaded);
    setData(loaded);
  }, []);

  const updateData = useCallback(
    (updater: (d: ToolboxData) => ToolboxData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveToolboxData(next);
        return next;
      });
    },
    []
  );

  const handleExport = useCallback(() => {
    if (!data) return;
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toolbox-data-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("数据已导出");
    } catch {
      showToast("导出失败", "error");
    }
  }, [data, showToast]);

  if (!data) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
        <div className="h-96 rounded-3xl bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border border-white/40 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <Workspace
      data={data}
      updateData={updateData}
      onExport={handleExport}
      showToast={showToast}
    />
  );
}

interface WorkspaceProps {
  data: ToolboxData;
  updateData: (updater: (d: ToolboxData) => ToolboxData) => void;
  onExport: () => void;
  showToast: (
    text: string,
    type?: "success" | "warning" | "error" | "info"
  ) => void;
}

function Workspace({ data, updateData, onExport, showToast }: WorkspaceProps) {
  const todosApi = useTodos(data.todos, (next) =>
    updateData((d) => ({ ...d, todos: next }))
  );

  const pomodoro = usePomodoro(
    data.pomodoro.state,
    data.pomodoro.settings,
    (nextState) =>
      updateData((d) => ({
        ...d,
        pomodoro: { ...d.pomodoro, state: nextState },
      })),
    (nextSettings) =>
      updateData((d) => ({
        ...d,
        pomodoro: { ...d.pomodoro, settings: nextSettings },
      })),
    {
      onFocusCompleted: (count, seconds) => {
        updateData((d) => {
          const today = todayKey();
          const entry = {
            dateKey: today,
            focusSeconds: seconds,
            completedFocus: count,
            completedTodos: 0,
          };
          const stats = d.stats.some((s) => s.dateKey === today)
            ? d.stats.map((s) => (s.dateKey === today ? entry : s))
            : [...d.stats, entry];
          return { ...d, stats };
        });
        playFinishSound(data.pomodoro.settings.sound);
        flashTitle("⏰ 专注完成，休息一下吧");
        maybeNotify("番茄钟", "本轮专注完成，休息一下吧");
        showToast("专注完成！+1 番茄", "success");
      },
      onBreakCompleted: () => {
        playFinishSound(data.pomodoro.settings.sound);
        flashTitle("休息结束，开始新一轮专注");
        showToast("休息结束，开始新一轮专注", "info");
      },
    }
  );

  return (
    <div className="w-full max-w-7xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
          工具箱
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
          轻量效率工具集 · 数据仅保存在当前浏览器，可随时导出备份
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
        <div className="lg:col-span-5">
          <TodoPanel api={todosApi} />
        </div>
        <div className="lg:col-span-7 flex flex-col gap-6">
          <PomodoroPanel api={pomodoro} todos={data.todos} />
          <StatsPanel
            stats={data.stats}
            todos={data.todos}
            pomodoroState={data.pomodoro.state}
            onExport={onExport}
          />
        </div>
      </div>
    </div>
  );
}
