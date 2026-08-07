import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TodoItem, TodoPriority } from "./types";
import { uid } from "./storage";

export type TodoFilter = "all" | "active" | "completed";
export type TodoSort = "created" | "priority" | "due";

export const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface UseTodosReturn {
  todos: TodoItem[];
  add: (title: string, extra?: Partial<TodoItem>) => void;
  toggle: (id: string) => void;
  update: (id: string, patch: Partial<TodoItem>) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  filter: TodoFilter;
  setFilter: (f: TodoFilter) => void;
  keyword: string;
  setKeyword: (k: string) => void;
  sort: TodoSort;
  setSort: (s: TodoSort) => void;
  visible: TodoItem[];
  counts: { total: number; active: number; completed: number };
}

export function useTodos(
  initial: TodoItem[],
  onTodosChange?: (todos: TodoItem[]) => void
): UseTodosReturn {
  const [todos, setTodos] = useState<TodoItem[]>(initial);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<TodoSort>("created");
  const persistRef = useRef(onTodosChange);

  useEffect(() => {
    persistRef.current = onTodosChange;
  });

  const commit = useCallback((updater: (prev: TodoItem[]) => TodoItem[]) => {
    setTodos((prev) => {
      const next = updater(prev);
      persistRef.current?.(next);
      return next;
    });
  }, []);

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
      commit((prev) => prev.filter((t) => t.id !== id));
    },
    [commit]
  );

  const clearCompleted = useCallback(() => {
    commit((prev) => prev.filter((t) => !t.completed));
  }, [commit]);

  const visible = useMemo(() => {
    let list = todos;
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(kw) || (t.note ?? "").toLowerCase().includes(kw)
      );
    }
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
  }, [todos, filter, keyword, sort]);

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
    filter,
    setFilter,
    keyword,
    setKeyword,
    sort,
    setSort,
    visible,
    counts,
  };
}
