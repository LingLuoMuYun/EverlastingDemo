export type TodoPriority = "low" | "medium" | "high";
export type PomodoroMode = "focus" | "shortBreak" | "longBreak";

export interface TodoItem {
  id: string;
  title: string;
  note?: string;
  priority: TodoPriority;
  tag?: string;
  dueDate?: string; // YYYY-MM-DD
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  pomodoroCount?: number; // v2: 累计关联番茄数
  lastFocusAt?: number; // v2: 最近一次被番茄钟关联的时间戳
  archived?: boolean; // v2: 归档标记
  deletedAt?: number; // v2: 软删除时间戳(配合撤销/回收站,当前为预留字段)
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number; // 每 N 个番茄进入长休
  autoSwitch: boolean;
  sound: boolean;
}

export interface PomodoroState {
  mode: PomodoroMode;
  running: boolean;
  endAt: number | null; // 结束时间戳，恢复/校准计时用
  completedFocus: number; // 今日已完成番茄数
  focusSeconds: number; // 今日累计专注秒数
  currentTodoId?: string;
  dateKey: string; // YYYY-MM-DD，跨天重置统计
}

export interface DailyStats {
  dateKey: string;
  focusSeconds: number;
  completedFocus: number;
  completedTodos: number;
}

export interface ToolboxData {
  version: 2;
  todos: TodoItem[];
  tags: string[]; // v2: 全局标签库
  pomodoro: {
    settings: PomodoroSettings;
    state: PomodoroState;
  };
  stats: DailyStats[];
}
