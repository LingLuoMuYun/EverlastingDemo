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
  version: 1;
  todos: TodoItem[];
  pomodoro: {
    settings: PomodoroSettings;
    state: PomodoroState;
  };
  stats: DailyStats[];
}
