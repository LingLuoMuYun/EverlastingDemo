"use client";

import { useCallback } from "react";
import { useToast } from "../../../components/ToastProvider";
import { useToolboxData } from "../../../components/toolbox/useToolboxData";
import { usePomodoro } from "../../../components/toolbox/usePomodoro";
import PomodoroPanel from "../../../components/toolbox/PomodoroPanel";
import StatsPanel from "../../../components/toolbox/StatsPanel";
import BackLink from "../../../components/toolbox/BackLink";
import {
  flashTitle,
  maybeNotify,
  playFinishSound,
} from "../../../components/toolbox/feedback";
import { todayKey } from "../../../components/toolbox/storage";
import type { ToolboxData } from "../../../components/toolbox/types";

export default function PomodoroClient() {
  const { data, updateData } = useToolboxData();
  const { showToast } = useToast();

  if (!data) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
        <div className="h-96 rounded-3xl bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border border-white/40 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <PomodoroWorkspace
      data={data}
      updateData={updateData}
      showToast={showToast}
    />
  );
}

function PomodoroWorkspace({
  data,
  updateData,
  showToast,
}: {
  data: ToolboxData;
  updateData: (updater: (d: ToolboxData) => ToolboxData) => void;
  showToast: (
    text: string,
    type?: "success" | "warning" | "error" | "info"
  ) => void;
}) {
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

  const handleExport = useCallback(() => {
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

  return (
    <div className="w-full max-w-5xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
      <BackLink />
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
          番茄钟
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
          专注计时 · 数据仅保存在当前浏览器
        </p>
      </div>
      <div className="flex flex-col gap-6 pb-10">
        <PomodoroPanel api={pomodoro} todos={data.todos} />
        <StatsPanel
          stats={data.stats}
          todos={data.todos}
          pomodoroState={data.pomodoro.state}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
