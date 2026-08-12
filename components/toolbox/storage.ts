import type { DailyStats, TodoItem, ToolboxData } from "./types";

/** key 保持稳定(避免丢旧数据),数据结构演进由 data.version + migrate 负责 */
export const STORAGE_KEY = "everlasting:toolbox:v1";
export const DATA_VERSION = 2;

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
    version: DATA_VERSION,
    todos: [],
    tags: [],
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

function collectTags(todos: TodoItem[]): string[] {
  const set = new Set<string>();
  for (const t of todos) {
    if (t.tag && t.tag.trim()) set.add(t.tag.trim());
  }
  return [...set];
}

/**
 * 数据迁移管线:把任意旧版本/结构的数据升级到当前版本。
 * 逐版本升级、每步只做一件事;失败时调用方回退默认值,不抛错。
 */
export function migrate(raw: unknown): ToolboxData {
  const base = defaultData();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Record<string, unknown>;
  const rawVersion = typeof parsed.version === "number" ? parsed.version : 1;

  const rawTodos = Array.isArray(parsed.todos) ? (parsed.todos as TodoItem[]) : [];

  let todos: TodoItem[];
  let tags: string[];

  if (rawVersion < 2) {
    // v1 → v2:任务补默认字段 + 标签库初始化 + 版本号提升
    todos = rawTodos.map((t) => ({
      pomodoroCount: 0,
      archived: false,
      ...t,
    }));
    tags = collectTags(todos);
  } else {
    // 已是 v2+:逐项补齐默认字段(幂等),保留已有 tags
    todos = rawTodos.map((t) => ({
      pomodoroCount: 0,
      archived: false,
      ...t,
    }));
    tags = Array.isArray(parsed.tags)
      ? (parsed.tags as string[]).filter((x): x is string => typeof x === "string")
      : collectTags(todos);
  }

  return {
    version: DATA_VERSION,
    todos,
    tags,
    pomodoro: {
      settings: {
        ...base.pomodoro.settings,
        ...((parsed.pomodoro as Record<string, unknown> | undefined)?.settings ?? {}),
      },
      state: {
        ...base.pomodoro.state,
        ...((parsed.pomodoro as Record<string, unknown> | undefined)?.state ?? {}),
      },
    },
    stats: Array.isArray(parsed.stats) ? (parsed.stats as DailyStats[]) : [],
  };
}

export function loadToolboxData(): ToolboxData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrate(parsed);
    const rawVersion = (parsed as { version?: unknown } | null)?.version;
    // 升级后原地写回,保证下次加载直接命中当前版本
    if (typeof rawVersion !== "number" || rawVersion < DATA_VERSION) {
      saveToolboxData(migrated);
    }
    return migrated;
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
