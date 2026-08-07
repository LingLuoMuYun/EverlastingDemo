import type { DailyStats, ToolboxData } from "./types";

export const STORAGE_KEY = "everlasting:toolbox:v1";

export function dateKeyOfTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayKey(): string {
  return dateKeyOfTs(Date.now());
}

/** 今天往前/往后 offset 天的日期 key */
export function dateKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKeyOfTs(d.getTime());
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultData(): ToolboxData {
  return {
    version: 1,
    todos: [],
    pomodoro: {
      settings: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
        autoSwitch: true,
        sound: true,
      },
      state: {
        mode: "focus",
        running: false,
        endAt: null,
        completedFocus: 0,
        focusSeconds: 0,
        dateKey: todayKey(),
      },
    },
    stats: [],
  };
}

export function loadToolboxData(): ToolboxData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as Partial<ToolboxData>;
    const base = defaultData();
    return {
      ...base,
      ...parsed,
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      pomodoro: {
        ...base.pomodoro,
        ...(parsed.pomodoro ?? {}),
        settings: { ...base.pomodoro.settings, ...(parsed.pomodoro?.settings ?? {}) },
        state: { ...base.pomodoro.state, ...(parsed.pomodoro?.state ?? {}) },
      },
      stats: Array.isArray(parsed.stats) ? parsed.stats : [],
    };
  } catch {
    return defaultData();
  }
}

export function saveToolboxData(data: ToolboxData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量满/隐私模式静默失败，不影响页面交互
  }
}

/** 跨天处理：把昨天的统计归档到 stats，并重置今日计数 */
export function normalizeDay(data: ToolboxData): ToolboxData {
  const today = todayKey();
  const s = data.pomodoro.state;
  if (s.dateKey === today) return data;
  const archived: DailyStats = {
    dateKey: s.dateKey,
    focusSeconds: s.focusSeconds,
    completedFocus: s.completedFocus,
    completedTodos: data.todos.filter(
      (t) => t.completedAt && dateKeyOfTs(t.completedAt) === s.dateKey
    ).length,
  };
  return {
    ...data,
    stats: [...data.stats.filter((x) => x.dateKey !== s.dateKey), archived],
    pomodoro: {
      ...data.pomodoro,
      state: {
        ...s,
        dateKey: today,
        completedFocus: 0,
        focusSeconds: 0,
        running: false,
        endAt: null,
      },
    },
  };
}
