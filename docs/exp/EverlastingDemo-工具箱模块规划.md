# EverlastingDemo 工具箱模块规划

> **版本**：v0.1（规划稿）｜**日期**：2026-08-07
> **状态**：仅规划，未修改任何代码
> **一句话目标**：在现有纯展示型站点上新增「工具箱」模块，首发 TodoList（待办清单）＋番茄钟＋今日/近 7 日专注统计（ECharts 柱状图/饼图），用纯前端 localStorage 持久化，仅新增 `echarts` 一个依赖，延续现有毛玻璃设计语言。

---

## 一、背景与现状

### 1.1 现状盘点（2026-08-07 对照代码）

| 项目 | 现状 |
|---|---|
| 技术栈 | Next.js 16（App Router）+ React 19 + TypeScript 5 + Tailwind CSS v4 + Framer Motion + lucide-react |
| 页面 | 首页 / 项目 / 归档 / 照片墙 / 音乐 / 杂谈 / 关于，均为内容展示型 |
| 导航 | `components/Navbar.tsx` 内 `navLinks` 数组硬编码；PC 顶栏与移动端转盘共用同一数组 |
| 数据 | 无数据库；内容即文件（`notes/*.md`、`data/*.json`），管理后台写文件后 git push |
| 交互工具 | 目前没有面向访客的"工具型"页面（音乐播放器是唯一强交互模块） |
| 现有空目录 | `components/toolbox/` 已存在（未纳入 git），可直接作为新组件目录 |
| 全局基建 | `ToastProvider`（轻提示）、`PageTransition`（页面过渡）、毛玻璃卡片样式、暗/亮主题均已具备 |

### 1.2 为什么做工具箱

1. **提升站点实用性**：目前站点"只展示不做事"，工具箱让访客（主要是博主自己）在站内直接完成待办管理、专注计时。
2. **模块化扩展**：工具箱天然适合承载多个轻量小工具（TodoList、番茄钟、倒计时、习惯打卡……），一次搭好"页面壳 + 存储层 + 组件目录"，后续加工具成本极低。
3. **与技术栈契合**：纯前端 + localStorage 即可完成，不引入数据库、不依赖后端、不破坏现有"文件即内容"的发布体系。

### 1.3 设计约束（红线）

- **不改动现有内容体系**：不新增数据库、不把用户数据写进 git 仓库（工具箱数据属于"个人使用数据"，只存浏览器 localStorage）。
- **依赖克制**：状态管理、音效用 React 原生能力 + 现有依赖实现；统计图表唯一新增依赖 `echarts`（^6.1.0），采用 `echarts/core` 按需注册 + 自封装轻量组件，避免引入完整包与第三方 React 包装层。
- **延续设计语言**：毛玻璃卡片（`bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border-white/30`）、`PageTransition`、暗色主题适配、页面顶部大标题风格与照片墙/音乐页一致。
- **SSR 安全**：所有读写 localStorage 的逻辑只发生在客户端组件挂载后，避免 hydration 不一致。

---

## 二、功能规划

### 2.1 模块入口

- 新增路由 `/toolbox`，导航栏「工具箱」插在「杂谈」与「关于」之间：
  - PC 顶栏：新增一个文字链接，样式与其他链接完全一致（含 active 高亮与底部圆点）。
  - 移动端转盘：`navLinks.length` 驱动角度均分（现有代码 `index * (360 / navLinks.length)`），自动变为 8 等分，无需改布局代码。
- 页面 metadata：`title: "工具箱 | " + siteConfig.title`，复用 `getSiteConfig()`。
- 页面壳：`min-h-screen` + `<Navbar />` + `<PageTransition>`，与 timeline/notes 等页面一致。

### 2.2 V1 首发功能

| 功能 | 说明 | 关键交互 | 存储 |
|---|---|---|---|
| TodoList 待办清单 | 任务管理：标题必填，可选备注/优先级/标签/截止日期 | 添加、勾选完成、编辑、删除、一键清空已完成、搜索、按状态筛选、按优先级/截止日期排序 | localStorage |
| 番茄钟 | 专注 / 短休 / 长休三态，默认 25/5/15 分钟，每 4 个番茄进入长休 | 开始 / 暂停 / 重置 / 跳过；环形进度动画；结束时提示音 + 页面标题闪烁；可选关联 TodoList 中的任务；自动切换专注↔休息（可关） | localStorage |
| 今日概览 | 今日完成番茄数、专注分钟数、完成任务数、进行中任务数 | 与两个工具实时联动；ECharts 柱状图（近 7 日专注分钟）＋饼图（任务完成状态占比） | localStorage（历史按天归档） |
| 数据导出 | 一键把全部工具箱数据导出为 JSON 文件下载 | 导出按钮 | 下载 `.json`（导入留到 V2） |

#### 2.2.1 TodoList 细节

- 任务字段：`标题`（必填）、`备注`（可选）、`优先级`（低/中/高，视觉区分颜色）、`标签`（可选，单选文本，用于轻量分组）、`截止日期`（可选，`YYYY-MM-DD`）、`完成状态`、`创建时间`、`完成时间`。
- 列表操作：
  - 勾选圆点切换完成；完成的条目置灰加删除线，显示完成时间。
  - 点击条目展开可编辑（标题/备注/优先级/标签/截止日期），或提供编辑按钮。
  - 删除单条（带确认气泡或 Toast 二次确认）；"清空已完成"一键操作。
  - 顶部计数：`进行中 x · 已完成 y · 共 z`，并显示完成进度条。
  - 筛选 Tab：全部 / 进行中 / 已完成；搜索框按标题+备注过滤。
  - 排序：默认按创建时间倒序；可切换"按优先级"、"按截止日期"。
- 与番茄钟联动：番茄钟面板可选择一个"当前任务"，选中后任务标题显示在计时器上；完成一个番茄时可选择"给当前任务 +1 个番茄"或直接完成该任务（V1 先做"显示关联 + 统计计数"，V2 再做一键完成）。

#### 2.2.2 番茄钟细节

- 三种模式：`focus`（专注）、`shortBreak`（短休）、`longBreak`（长休）。
- 时长可自定义（分钟数，整数 1~120）：专注默认 25、短休默认 5、长休默认 15、长休间隔默认 4。
- 计时准确性：保存 `endAt`（结束时间戳），用 `setInterval(250ms)` 计算 `endAt - Date.now()` 渲染剩余时间；切后台/休眠恢复后自动校准，不做"计数器递减"（避免标签页挂起后时间失真）。
- 一个专注周期结束时：
  - 播放提示音（`AudioContext` 生成短促蜂鸣，无需音频文件）；
  - 页面 `document.title` 闪烁提示（如 `⏰ 专注结束`，5 秒后还原）；
  - 若浏览器支持 `Notification` 且用户已授权，发送系统通知（失败静默）；
  - 今日统计 +1 个番茄、累计专注秒数累加；
  - 按 `autoSwitch` 设置决定是否自动切到休息，休息结束再自动切回专注（自动模式），或停在待开始状态。
- 状态持久化：刷新页面后恢复"模式 + 剩余时间 + 是否运行中"，`endAt` 存 localStorage，恢复时用当前时间重新计算剩余。

#### 2.2.3 统计面板细节

- 今日卡片：`今日专注 25 分钟 · 3 个番茄 · 完成 5 个任务`。
- **ECharts 图表区（统计面板下半部分）**：
  - 柱状图：近 7 日每日专注分钟（取 `stats` 最近 7 天的 `focusSeconds`，不足 7 天补 0），tooltip 显示具体分钟，柱色用主题强调色（indigo）。
  - 饼图：当前任务完成状态占比（已完成 / 进行中，按数量），tooltip 显示数量与百分比；后续可扩展"优先级分布""专注/休息时间构成"。
  - 主题联动：读取 `useTheme()` 的 `isDark`，重建 option 的 `textStyle` / 坐标轴 / tooltip 配色，暗亮切换不闪烁。
- 数据来源：番茄钟完成时写当日 `DailyStats`；TodoList 完成任务时同步 +1 完成数。
- 跨天处理：页面加载时比较 `dateKey`（`YYYY-MM-DD`），若与今天不同，则把昨天的统计归档到 `stats` 数组并重置今日计数。

### 2.3 V2+ 扩展方向（本期只规划不实现）

| 工具 | 说明 |
|---|---|
| 倒计时 / 秒表 | 复用番茄钟的计时骨架，增加独立小卡片 |
| 习惯打卡 | 每日勾选习惯，近 30 天热力图 |
| 白噪音 | 内置几段循环音频（雨声/海浪），配音量控制 |
| 灵感速记 | 极简便签，与杂谈区分：不发布、仅本地 |
| 数据导入 / 云同步 | 导入 JSON 恢复数据；可选 GitHub Gist 或 WebDAV 同步（跨设备） |
| PWA / 离线 | 让工具箱在无网络时也能用（需评估全站改造成本） |

---

## 三、技术方案

### 3.1 总体架构

```
app/toolbox/page.tsx（服务端壳：metadata + Navbar + PageTransition）
        └─ app/toolbox/ToolboxClient.tsx（"use client"：读 localStorage、装配数据、分栏布局）
              ├─ components/toolbox/TodoPanel.tsx      （TodoList）
              ├─ components/toolbox/PomodoroPanel.tsx  （番茄钟）
              └─ components/toolbox/StatsPanel.tsx     （今日概览 + ECharts 柱状图/饼图）
                    └─ components/toolbox/EChart.tsx   （echarts/core 轻量封装）
```

- 页面路由是服务端组件（与现有页面一致），真正的工具 UI 全部在客户端组件里。
- 数据流：`ToolboxClient` 用 `loadToolboxData()` 读取一次 → 分发给三个子面板 → 任何变更回调 `saveToolboxData()` 写回。单一数据源 + 单向数据流，无需引入状态库。

### 3.2 文件清单（预计新增/修改）

| 文件 | 类型 | 说明 |
|---|---|---|
| `app/toolbox/page.tsx` | 新增 | 服务端页面壳 + metadata |
| `app/toolbox/ToolboxClient.tsx` | 新增 | 客户端主容器：布局、数据装配、跨天重置 |
| `components/toolbox/types.ts` | 新增 | 全部类型定义 |
| `components/toolbox/storage.ts` | 新增 | localStorage 读写、默认值、容错、uid 生成 |
| `components/toolbox/useTodos.ts` | 新增 | Todo 状态 hook（增删改查/筛选排序） |
| `components/toolbox/usePomodoro.ts` | 新增 | 番茄钟状态 hook（endAt 计时/模式切换/统计） |
| `components/toolbox/TodoPanel.tsx` | 新增 | TodoList 面板 UI |
| `components/toolbox/PomodoroPanel.tsx` | 新增 | 番茄钟面板 UI（SVG 环形进度） |
| `components/toolbox/StatsPanel.tsx` | 新增 | 今日概览 + ECharts 图表区 |
| `components/toolbox/EChart.tsx` | 新增 | ECharts 轻量封装（init / setOption / resize / dispose） |
| `components/toolbox/chartOptions.ts` | 新增 | 柱状图 / 饼图 option 构建函数（含暗亮主题配色） |
| `components/Navbar.tsx` | 修改 | `navLinks` 数组插入工具箱入口（仅 1 行） |
| `package.json` | 修改 | 新增依赖 `echarts` ^6.1.0 |

### 3.3 数据模型（代码实现核心）

```ts
// components/toolbox/types.ts
export type TodoPriority = "low" | "medium" | "high";
export type PomodoroMode = "focus" | "shortBreak" | "longBreak";

export interface TodoItem {
  id: string;
  title: string;
  note?: string;
  priority: TodoPriority;        // 默认 "medium"
  tag?: string;
  dueDate?: string;              // YYYY-MM-DD，可选
  completed: boolean;
  createdAt: number;             // 时间戳
  completedAt?: number;
}

export interface PomodoroSettings {
  focusMinutes: number;          // 默认 25
  shortBreakMinutes: number;     // 默认 5
  longBreakMinutes: number;      // 默认 15
  longBreakInterval: number;     // 每 N 个番茄进入长休，默认 4
  autoSwitch: boolean;           // 专注结束自动切休息，默认 true
  sound: boolean;                // 结束提示音，默认 true
}

export interface PomodoroState {
  mode: PomodoroMode;
  running: boolean;
  endAt: number | null;          // 结束时间戳，恢复/校准计时用
  completedFocus: number;        // 今日已完成番茄数
  focusSeconds: number;          // 今日累计专注秒数
  currentTodoId?: string;        // 关联的 Todo
  dateKey: string;               // "YYYY-MM-DD"，跨天重置统计
}

export interface DailyStats {
  dateKey: string;               // "YYYY-MM-DD"
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
  stats: DailyStats[];           // 历史按天归档，用于 7 日图
}
```

### 3.4 存储层（代码实现核心）

```ts
// components/toolbox/storage.ts
import type { ToolboxData, TodoItem, PomodoroState } from "./types";

export const STORAGE_KEY = "everlasting:toolbox:v1";

export function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
    // 深合并默认值，缺字段补默认，坏数据回退
    const base = defaultData();
    return {
      ...base,
      ...parsed,
      pomodoro: {
        ...base.pomodoro,
        ...(parsed.pomodoro ?? {}),
        settings: { ...base.pomodoro.settings, ...(parsed.pomodoro?.settings ?? {}) },
        state: { ...base.pomodoro.state, ...(parsed.pomodoro?.state ?? {}) },
      },
      stats: Array.isArray(parsed.stats) ? parsed.stats : [],
    };
  } catch {
    return defaultData(); // 坏 JSON 直接回退，不阻塞页面
  }
}

export function saveToolboxData(data: ToolboxData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量满/隐私模式静默失败，不影响页面交互
  }
}
```

### 3.5 Todo hook（代码实现核心）

```ts
// components/toolbox/useTodos.ts
import { useMemo, useState } from "react";
import type { TodoItem, TodoPriority } from "./types";
import { uid } from "./storage";

export type TodoFilter = "all" | "active" | "completed";

export function useTodos(initial: TodoItem[]) {
  const [todos, setTodos] = useState<TodoItem[]>(initial);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [keyword, setKeyword] = useState("");

  const add = (title: string, extra?: Partial<TodoItem>) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const item: TodoItem = {
      id: uid(),
      title: trimmed,
      priority: "medium",
      completed: false,
      createdAt: Date.now(),
      ...extra,
    };
    setTodos((prev) => [item, ...prev]);
  };

  const toggle = (id: string) =>
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: !t.completed, completedAt: t.completed ? undefined : Date.now() }
          : t
      )
    );

  const update = (id: string, patch: Partial<TodoItem>) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const remove = (id: string) => setTodos((prev) => prev.filter((t) => t.id !== id));

  const clearCompleted = () => setTodos((prev) => prev.filter((t) => !t.completed));

  const visible = useMemo(() => {
    let list = todos;
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(kw) || (t.note ?? "").toLowerCase().includes(kw)
      );
    }
    return list;
  }, [todos, filter, keyword]);

  const counts = useMemo(
    () => ({
      total: todos.length,
      active: todos.filter((t) => !t.completed).length,
      completed: todos.filter((t) => t.completed).length,
    }),
    [todos]
  );

  return { todos, add, toggle, update, remove, clearCompleted, filter, setFilter, keyword, setKeyword, visible, counts };
}

export const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };
```

### 3.6 番茄钟 hook（代码实现核心）

```ts
// components/toolbox/usePomodoro.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { PomodoroMode, PomodoroSettings, PomodoroState } from "./types";
import { todayKey } from "./storage";

const MODE_MINUTES: Record<PomodoroMode, keyof PomodoroSettings> = {
  focus: "focusMinutes",
  shortBreak: "shortBreakMinutes",
  longBreak: "longBreakMinutes",
};

export function usePomodoro(initialState: PomodoroState, initialSettings: PomodoroSettings) {
  const [state, setState] = useState<PomodoroState>(() =>
    initialState.dateKey === todayKey()
      ? initialState
      : { ...initialState, dateKey: todayKey(), completedFocus: 0, focusSeconds: 0, running: false, endAt: null }
  );
  const [settings, setSettings] = useState<PomodoroSettings>(initialSettings);
  const [remainingMs, setRemainingMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const onFinishRef = useRef<() => void>(() => {});

  // 初始剩余时间 = 结束时间戳 - 当前时间（刷新恢复）
  useEffect(() => {
    const total = (settings[MODE_MINUTES[state.mode]] as number) * 60_000;
    setRemainingMs(state.endAt ? Math.max(0, state.endAt - Date.now()) : total);
  }, [state.mode, state.endAt, settings]);

  useEffect(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (!state.running) return;
    tickRef.current = window.setInterval(() => {
      const left = Math.max(0, (state.endAt ?? 0) - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(tickRef.current!);
        setState((prev) => ({ ...prev, running: false, endAt: null }));
        onFinishRef.current();
      }
    }, 250);
    return () => window.clearInterval(tickRef.current!);
  }, [state.running, state.endAt]);

  const start = useCallback(() => {
    setState((prev) => {
      const total = (settings[MODE_MINUTES[prev.mode]] as number) * 60_000;
      return { ...prev, running: true, endAt: Date.now() + total };
    });
  }, [settings]);

  const pause = useCallback(() => setState((prev) => ({ ...prev, running: false })));

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      running: false,
      endAt: null,
      mode: "focus",
    }));
  }, []);

  const switchMode = useCallback((mode: PomodoroMode) => {
    setState((prev) => ({ ...prev, mode, running: false, endAt: null }));
  }, []);

  const setOnFinish = useCallback((fn: () => void) => { onFinishRef.current = fn; }, []);

  return { state, settings, setSettings, remainingMs, start, pause, reset, switchMode, setOnFinish };
}

export function formatMs(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
```

> 说明：`onFinishRef` 用于在计时归零时触发"完成番茄 / 提示音 / 切模式 / 写统计"等副作用，避免在 interval 闭包里直接改状态造成重复执行。完整实现时在 `ToolboxClient` 里注册 `setOnFinish`。

### 3.7 UI 骨架

#### 3.7.1 页面壳

```tsx
// app/toolbox/page.tsx（服务端组件）
import { getSiteConfig } from "@/lib/site";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import ToolboxClient from "./ToolboxClient";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "工具箱 | " + siteConfig.title,
  description: "TodoList、番茄钟与专注统计",
};

export default function ToolboxPage() {
  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <ToolboxClient />
      </PageTransition>
    </div>
  );
}
```

#### 3.7.2 主容器（分栏布局）

```tsx
// app/toolbox/ToolboxClient.tsx（"use client"）
// 桌面：左列 TodoList（约 5/12），右列上番茄钟、下统计；移动端纵向堆叠。
// 数据装配：useState(() => loadToolboxData()) → 各面板变更 → saveToolboxData(next)
// 关键点：mounted 后首次 setState 同步 localStorage（避免 hydration 不一致）
```

#### 3.7.3 TodoPanel 要点

```tsx
// components/toolbox/TodoPanel.tsx
// - 输入行：标题输入框 + 优先级下拉 + 「添加」按钮（Enter 提交）
// - 筛选行：全部/进行中/已完成 Tab + 搜索框 + 清空已完成按钮
// - 列表：毛玻璃卡片条目；勾选圆点、标题、优先级色点、标签徽章、截止日期、删除/编辑按钮
// - 计数：进行中 x · 已完成 y · 进度条
// 图标：ListTodo、Plus、Check、Trash2、Pencil、Flag、CalendarDays（lucide-react）
```

#### 3.7.4 PomodoroPanel 要点

```tsx
// components/toolbox/PomodoroPanel.tsx
// - 模式 Tab：专注 / 短休 / 长休
// - SVG 环形进度：stroke-dashoffset = 剩余比例；中央大号 MM:SS
// - 控制按钮：开始 / 暂停 / 重置 / 跳过
// - 设置：三个时长输入 + 长休间隔 + 自动切换开关 + 提示音开关
// - 关联任务：下拉选择 TodoList 中未完成任务，显示在计时器下方
// 图标：Timer、Play、Pause、RotateCcw、SkipForward、Settings
```

#### 3.7.5 StatsPanel 要点

```tsx
// components/toolbox/StatsPanel.tsx
// - 今日卡片：专注分钟 / 番茄数 / 完成任务数
// - 图表区：EChart 组件渲染柱状图（近 7 日专注分钟）+ 饼图（任务完成状态占比）
// - 导出按钮：Blob + URL.createObjectURL 下载 toolbox-data.json
// 图标：Flame、Clock3、CheckCircle2、Download
```

### 3.8 ECharts 接入方案（代码实现核心）

> 方案：不引入 `echarts-for-react`，直接使用 `echarts/core` 按需注册 + 自封装 `EChart.tsx`。原因：包体积可控（只带用到的图表）、React 19 兼容性无第三方包装层风险、图表生命周期完全自主。

**依赖**：`npm i echarts`（当前最新 ^6.1.0），全项目仅新增此一个依赖。

**轻量封装**（新增 `components/toolbox/EChart.tsx`）：

```tsx
"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// 按需注册：只带用到的图表 / 组件 / 渲染器，压缩后远小于全量包
echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export default function EChart({
  option,
  className = "h-48 w-full",
}: {
  option: echarts.EChartsCoreOption;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const ro = new ResizeObserver(() => chart.resize()); // 双栏/移动端布局变化自适应
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = echarts.getInstanceByDom(ref.current!);
    chart?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} />;
}
```

**option 构建**（新增 `components/toolbox/chartOptions.ts`）：

```ts
import type { DailyStats } from "./types";

// 近 7 日专注分钟柱状图；isDark 控制文字/坐标轴颜色，与全站主题联动
export function buildFocusBarOption(stats: DailyStats[], isDark: boolean) {
  const days = stats.slice(-7); // 不足 7 天由调用方补 0
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: days.map((d) => d.dateKey.slice(5)),
      axisLine: { lineStyle: { color: isDark ? "#475569" : "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: isDark ? "#1e293b" : "#e2e8f0" } },
    },
    series: [
      {
        type: "bar",
        data: days.map((d) => Math.round(d.focusSeconds / 60)),
        itemStyle: { color: "#6366f1", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

// 任务完成状态饼图：已完成 / 进行中
export function buildStatusPieOption(completed: number, active: number, isDark: boolean) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    legend: { textStyle: { color: isDark ? "#e2e8f0" : "#334155" } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        label: { color: isDark ? "#e2e8f0" : "#334155" },
        data: [
          { name: "已完成", value: completed, itemStyle: { color: "#10b981" } },
          { name: "进行中", value: active, itemStyle: { color: "#6366f1" } },
        ],
      },
    ],
  };
}
```

**接入要点**：
1. `StatsPanel` 用 `useTheme()` 取 `isDark`，用 `useMemo` 根据数据 + `isDark` 构建 option，传给 `EChart`。
2. `echarts.init` 只在 `useEffect`（浏览器端）执行，天然规避 SSR；统计面板与 localStorage 读取同一时机（mounted 后）渲染。
3. 容器必须有明确高度（如 `h-48` / `h-52`），`ResizeObserver` 保证双栏 / 移动端布局切换时自适应。
4. 如需进一步拆包，可用 `next/dynamic(() => import("./StatsPanel"), { ssr: false })` 懒加载统计面板；V1 先按 `npm run build` 产物大小评估，非必须。

### 3.9 导航改动（唯一需要改动的既有代码）

```tsx
// components/Navbar.tsx 内 navLinks 数组，新增一行：
const navLinks = [
  { name: "首页", href: "/" },
  { name: "项目", href: "/projects" },
  { name: "归档", href: "/timeline" },
  { name: "照片墙", href: "/photowall" },
  { name: "音乐", href: "/music" },
  { name: "杂谈", href: "/notes" },
  { name: "工具箱", href: "/toolbox" },   // ← 新增
  { name: "关于", href: "/about" },
];
```

PC 顶栏与移动端转盘共用该数组，改动后自动生效；active 判断（`pathname === link.href`）与高亮样式无需额外修改。

---

## 四、UI 布局草图

```text
桌面端（max-w-7xl，mt-28）：
┌─────────────────────────────────────────────────────────────┐
│  工具箱（大标题 + 副标题"轻量效率工具集"）                      │
├───────────────────────────────┬─────────────────────────────┤
│  TodoList 待办清单            │  番茄钟                      │
│  [输入框 + 优先级 + 添加]      │  ┌─────────┐ 25:00         │
│  全部/进行中/已完成 | 搜索      │  │ 环形进度 │ 专注中/待开始   │
│  ☑ 写规划文档     高  [标签]   │  └─────────┘                │
│  ○ 修复照片墙 bug  中  [标签]  │  开始 暂停 重置 跳过          │
│  ○ 整理音乐歌单    低          │  设置：25/5/15/4 自动切换 音效 │
│  进度条 进行中 2 · 已完成 1    │  当前任务：写规划文档          │
│  [清空已完成]                  │─────────────────────────────│
│                               │  今日概览 + 柱状图 + 饼图      │
│                               │  [导出数据]                  │
└───────────────────────────────┴─────────────────────────────┘

移动端：卡片从上到下依次堆叠（TodoList → 番茄钟 → 统计），容器 px-4。
```

---

## 五、实施步骤（审批后执行）

| 阶段 | 内容 | 验证 |
|---|---|---|
| A. 数据层 | `types.ts` → `storage.ts` → `useTodos.ts` → `usePomodoro.ts` | `npx tsc --noEmit` |
| B. Todo 面板 | `TodoPanel.tsx` 增删改查 + 筛选搜索 | `npm run lint` |
| C. 番茄钟面板 | `PomodoroPanel.tsx` 计时/模式/提醒 + 完成回调 | 手测切后台恢复校准 |
| D. 图表接入 | `npm i echarts`；`EChart.tsx` + `chartOptions.ts` + StatsPanel 图表区 | `npm run lint` |
| E. 统计与组装 | `StatsPanel.tsx` 完整化 + `ToolboxClient.tsx` + `app/toolbox/page.tsx` | `npm run build` |
| F. 导航接入 | `Navbar.tsx` 加入口 | 手测 PC/移动端 |
| G. 收尾 | `npm run lint`、`npx tsc --noEmit`、`npm run build`、手测清单 | 全部通过后 `git add → commit → push origin main` |

---

## 六、验收清单

- [ ] 访问 `/toolbox` 正常渲染，metadata 标题正确，PC 顶栏与移动端转盘均有「工具箱」入口且高亮正确
- [ ] TodoList：添加/编辑/完成/删除/清空已完成/搜索/筛选/排序均正常，刷新后数据保留
- [ ] 番茄钟：开始/暂停/重置/跳过正常；结束触发提示音与统计；刷新页面恢复剩余时间
- [ ] 统计：今日专注分钟、番茄数、完成任务数与操作实时联动；跨天自动重置
- [ ] ECharts：柱状图（近 7 日专注分钟）与饼图（任务完成状态）正确渲染；暗/亮主题切换配色跟随；窗口缩放自适应；无 SSR 报错与 hydration 警告；构建产物大小可接受
- [ ] 数据导出下载 JSON 且内容完整
- [ ] 暗色/亮色主题、移动端布局、页面过渡动画与全站一致
- [ ] `npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过

---

## 七、风险与注意事项

| 风险 | 说明与对策 |
|---|---|
| localStorage 数据丢失 | 浏览器清缓存/换设备即丢；页面内提供导出备份，V2 规划云同步 |
| hydration 不一致 | 所有 localStorage 读取放在客户端 `mounted` 之后，首帧渲染默认值 |
| 计时漂移 | 一律用 `endAt` 时间戳校准，不依赖 setInterval 次数累加 |
| 标签页休眠 | 恢复后按 `endAt - now` 重新计算，未完成时段计入"跑了多少"并提示 |
| 通知权限 | Notification 需用户授权；未授权或失败一律静默，不影响主流程 |
| 浏览器不支持 AudioContext | 提示音失败静默，仅保留标题闪烁 |
| 移动端宽度 | 双栏改单栏堆叠，按钮触控区域 ≥ 40px |
| 与主题一致性 | 卡片/按钮全部沿用现有毛玻璃 + indigo 强调色 + dark: 变体 |
| ECharts 包体积 | 全量 echarts 较大；采用 `echarts/core` 按需注册（仅 BarChart / PieChart 等）显著瘦身；如仍偏大可对统计面板 `next/dynamic` 懒加载 |
| React 19 兼容 | 不使用 `echarts-for-react`（第三方包装层维护滞后），自封装 ~40 行 `EChart.tsx`，生命周期完全可控 |
| 图表 SSR / hydration | `echarts.init` 只在 `useEffect`（浏览器端）执行；统计面板 mounted 后再渲染 |
| 暗/亮主题 | 通过 `useTheme()` 的 `isDark` 重建 option；图表背景透明，跟随全站主题 |

---

## 八、后续迭代方向

1. **跨设备同步**：导出/导入 JSON → 可选 GitHub Gist 或 WebDAV 同步，与现有 git 发布体系解耦。
2. **更多小工具**：倒计时、秒表、习惯打卡热力图、白噪音、灵感便签，全部复用 `components/toolbox/` 目录与存储层。
3. **数据可视化**：周报视图（专注趋势、完成率）、年度统计。
4. **与站内内容联动**：番茄钟完成的专注可一键生成一条杂谈（`notes/*.md` + git push），把"个人工具"沉淀为"站内内容"。
5. **图表扩展**：周报视图（专注趋势折线、完成率环比）、年度热力图，全部复用 `EChart` 封装与 `chartOptions.ts` 构建层。
