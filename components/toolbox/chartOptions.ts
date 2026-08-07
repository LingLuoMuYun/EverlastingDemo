import type { DailyStats } from "./types";
import { dateKeyOffset } from "./storage";

const INDIGO = "#6366f1";
const EMERALD = "#10b981";

/** 近 7 日专注分钟柱状图；isDark 控制文字/坐标轴颜色，与全站主题联动 */
export function buildFocusBarOption(stats: DailyStats[], isDark: boolean) {
  const days: { label: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = dateKeyOffset(-i);
    const entry = stats.find((s) => s.dateKey === key);
    days.push({
      label: key.slice(5),
      minutes: entry ? Math.round(entry.focusSeconds / 60) : 0,
    });
  }
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const },
    grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: days.map((d) => d.label),
      axisLine: { lineStyle: { color: isDark ? "#475569" : "#cbd5e1" } },
      axisLabel: { color: isDark ? "#94a3b8" : "#64748b" },
    },
    yAxis: {
      type: "value" as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: isDark ? "#1e293b" : "#e2e8f0" } },
      axisLabel: { color: isDark ? "#94a3b8" : "#64748b" },
    },
    series: [
      {
        type: "bar" as const,
        data: days.map((d) => d.minutes),
        barMaxWidth: 28,
        itemStyle: { color: INDIGO, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

/** 任务完成状态饼图：已完成 / 进行中 */
export function buildStatusPieOption(
  completed: number,
  active: number,
  isDark: boolean
) {
  const textColor = isDark ? "#e2e8f0" : "#334155";
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" as const },
    legend: {
      bottom: 0,
      textStyle: { color: textColor },
    },
    series: [
      {
        type: "pie" as const,
        radius: ["42%", "68%"],
        center: ["50%", "45%"],
        label: { color: textColor, formatter: "{b} {c} ({d}%)" },
        data: [
          { name: "已完成", value: completed, itemStyle: { color: EMERALD } },
          { name: "进行中", value: active, itemStyle: { color: INDIGO } },
        ],
      },
    ],
  };
}
