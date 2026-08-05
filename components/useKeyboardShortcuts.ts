"use client";

import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekBy: (delta: number) => void;
  onVolumeBy: (delta: number) => void;
  onToggleMute: () => void;
}

/**
 * 全局键盘快捷键：
 * 空格=播放/暂停；←/→=快退/快进 5s；↑/↓=音量 ±0.05；M=静音；N/P=下一首/上一首
 * 输入框/文本域/可编辑元素聚焦时自动忽略，避免打字误触
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);

  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const h = ref.current;
      switch (e.key) {
        case " ":
          e.preventDefault();
          h.onTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          h.onSeekBy(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          h.onSeekBy(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          h.onVolumeBy(0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          h.onVolumeBy(-0.05);
          break;
        case "m":
        case "M":
          h.onToggleMute();
          break;
        case "n":
        case "N":
          h.onNext();
          break;
        case "p":
        case "P":
          h.onPrev();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
