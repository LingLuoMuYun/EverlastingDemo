"use client";

import { useEffect } from "react";

export type ShortcutFilter = "all" | "active" | "completed";

interface ShortcutHandlers {
  onFocusAdd: () => void;
  onFilter: (key: ShortcutFilter) => void;
  onEscape: () => void;
  onToggleHelp: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * TodoList 全局快捷键(仅桌面端意义明确,移动端不拦截):
 * N 聚焦新增、1/2/3 切筛选、Esc 取消/关闭、? 帮助。
 * 输入框/文本域聚焦时不触发,避免打字被拦截。
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape") handlers.onEscape();
        return;
      }
      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        handlers.onFocusAdd();
      } else if (k === "1") {
        handlers.onFilter("all");
      } else if (k === "2") {
        handlers.onFilter("active");
      } else if (k === "3") {
        handlers.onFilter("completed");
      } else if (e.key === "?") {
        handlers.onToggleHelp();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
