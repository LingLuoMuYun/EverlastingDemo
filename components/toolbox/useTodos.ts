import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TodoItem, TodoPriority } from "./types";
import { uid } from "./storage";

export type TodoFilter = "all" | "active" | "completed";
export type TodoSort = "created" | "priority" | "due" | "manual";

export const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** 删除/清空后的撤销窗口(毫秒),与回收站过期时间一致 */
export const RECYCLE_TTL = 5000;

/** 所有变更都以函数式更新回到上层单一数据源,避免闭包读到过期列表 */
export type TodosUpdater = (prev: TodoItem[]) => TodoItem[];

export interface UseTodosReturn {
  todos: TodoItem[];
  add: (title: string, extra?: Partial<TodoItem>) => void;
  toggle: (id: string) => void;
  update: (id: string, patch: Partial<TodoItem>) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  /** 撤销最近一次删除/清空:把给定任务重新插回列表顶部 */
  undoRemove: (items: TodoItem[]) => void;
  filter: TodoFilter;
  setFilter: (f: TodoFilter) => void;
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  keyword: string;
  setKeyword: (k: string) => void;
  sort: TodoSort;
  setSort: (s: TodoSort) => void;
  /** 手动排序：把 draggedId 移动到 targetId 之前 */
  moveBefore: (draggedId: string, targetId: string) => void;
  visible: TodoItem[];
  counts: { total: number; active: number; completed: number };
}

/**
 * 受控的 Todo 状态 hook:不持有任务列表副本,
 * 数据由父级(useToolboxData)统一持有,变更通过 onTodosChange 函数式回写。
 */
export function useTodos(
  todos: TodoItem[],
  onTodosChange: (updater: TodosUpdater) => void
): UseTodosReturn {
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<TodoSort>("created");
  // 内存回收站:只做过期清理记账,撤销本身由调用方携带的任务快照完成
  const recycleBinRef = useRef<{ items: TodoItem[]; expireAt: number }[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      recycleBinRef.current = recycleBinRef.current.filter(
        (e) => e.expireAt > now
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stageRemoval = useCallback((items: TodoItem[]) => {
    if (!items.length) return;
    recycleBinRef.current = [
      ...recycleBinRef.current,
      { items, expireAt: Date.now() + RECYCLE_TTL },
    ];
  }, []);

  const commit = useCallback(
    (updater: TodosUpdater) => onTodosChange(updater),
    [onTodosChange]
  );

  const add = useCallback(
    (title: string, extra?: Partial<TodoItem>) => {
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
      commit((prev) => [item, ...prev]);
    },
    [commit]
  );

  const toggle = useCallback(
    (id: string) => {
      commit((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: !t.completed,
                completedAt: t.completed ? undefined : Date.now(),
              }
            : t
        )
      );
    },
    [commit]
  );

  const update = useCallback(
    (id: string, patch: Partial<TodoItem>) => {
      commit((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [commit]
  );

  const remove = useCallback(
    (id: string) => {
      const item = todos.find((t) => t.id === id);
      if (item) stageRemoval([item]);
      commit((prev) => prev.filter((t) => t.id !== id));
    },
    [todos, commit, stageRemoval]
  );

  const clearCompleted = useCallback(() => {
    const completed = todos.filter((t) => t.completed);
    if (completed.length) stageRemoval(completed);
    commit((prev) => prev.filter((t) => !t.completed));
  }, [todos, commit, stageRemoval]);

  const undoRemove = useCallback(
    (items: TodoItem[]) => {
      if (!items.length) return;
      const ids = new Set(items.map((i) => i.id));
      recycleBinRef.current = recycleBinRef.current.filter(
        (e) => !e.items.some((x) => ids.has(x.id))
      );
      commit((prev) => [...items, ...prev]);
    },
    [commit]
  );

  const moveBefore = useCallback(
    (draggedId: string, targetId: string) => {
      commit((prev) => {
        const from = prev.findIndex((t) => t.id === draggedId);
        const to = prev.findIndex((t) => t.id === targetId);
        if (from < 0 || to < 0 || from === to) return prev;
        const next = [...prev];
        const [item] = next.splice(from, 1);
        const insertAt = next.findIndex((t) => t.id === targetId);
        next.splice(insertAt, 0, item);
        return next;
      });
    },
    [commit]
  );

  const visible = useMemo(() => {
    let list = todos;
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (tagFilter) list = list.filter((t) => t.tag?.trim() === tagFilter);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(kw) ||
          (t.note ?? "").toLowerCase().includes(kw) ||
          (t.tag ?? "").toLowerCase().includes(kw)
      );
    }
    if (sort === "manual") return list; // 手动排序：保持数组顺序
    const sorted = [...list];
    if (sort === "priority") {
      sorted.sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.createdAt - a.createdAt
      );
    } else if (sort === "due") {
      sorted.sort(
        (a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
          b.createdAt - a.createdAt
      );
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [todos, filter, tagFilter, keyword, sort]);

  const counts = useMemo(
    () => ({
      total: todos.length,
      active: todos.filter((t) => !t.completed).length,
      completed: todos.filter((t) => t.completed).length,
    }),
    [todos]
  );

  return {
    todos,
    add,
    toggle,
    update,
    remove,
    clearCompleted,
    undoRemove,
    filter,
    setFilter,
    tagFilter,
    setTagFilter,
    keyword,
    setKeyword,
    sort,
    setSort,
    moveBefore,
    visible,
    counts,
  };
}
