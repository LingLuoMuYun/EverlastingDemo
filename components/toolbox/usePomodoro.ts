import { useCallback, useEffect, useRef, useState } from "react";
import type { PomodoroMode, PomodoroSettings, PomodoroState } from "./types";

type MinuteKey = "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes";

const MODE_MINUTES: Record<PomodoroMode, MinuteKey> = {
  focus: "focusMinutes",
  shortBreak: "shortBreakMinutes",
  longBreak: "longBreakMinutes",
};

const MODE_LABEL: Record<PomodoroMode, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};

export interface PomodoroHandlers {
  onFocusCompleted?: (completedFocus: number, focusSeconds: number) => void;
  onBreakCompleted?: () => void;
}

export interface UsePomodoroReturn {
  state: PomodoroState;
  settings: PomodoroSettings;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  remainingMs: number;
  totalMs: number;
  progress: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchMode: (mode: PomodoroMode) => void;
  skip: () => void;
  /** 立即结束当前阶段（专注会计入番茄数与专注时长，与自然结束一致） */
  finish: () => void;
  setCurrentTodo: (id?: string) => void;
}

export function usePomodoro(
  initialState: PomodoroState,
  initialSettings: PomodoroSettings,
  onStateChange?: (state: PomodoroState) => void,
  onSettingsChange?: (settings: PomodoroSettings) => void,
  handlers?: PomodoroHandlers
): UsePomodoroReturn {
  const [state, setState] = useState<PomodoroState>(initialState);
  const [settings, setSettings] = useState<PomodoroSettings>(initialSettings);
  const [remainingMs, setRemainingMs] = useState(() => {
    if (initialState.running && initialState.endAt) {
      return Math.max(0, initialState.endAt - Date.now());
    }
    return initialSettings[MODE_MINUTES[initialState.mode]] * 60_000;
  });

  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const remainingRef = useRef(remainingMs);
  const persistStateRef = useRef(onStateChange);
  const persistSettingsRef = useRef(onSettingsChange);
  const handlersRef = useRef(handlers);
  const originalTitleRef = useRef<string | null>(null);
  const titleTimerRef = useRef<number | null>(null);
  const flashUntilRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  });
  useEffect(() => {
    settingsRef.current = settings;
  });
  useEffect(() => {
    persistStateRef.current = onStateChange;
  });
  useEffect(() => {
    persistSettingsRef.current = onSettingsChange;
  });
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const applyRemaining = useCallback((ms: number) => {
    remainingRef.current = ms;
    setRemainingMs(ms);
  }, []);

  const setDocumentTitle = useCallback((text: string) => {
    try {
      document.title = text;
    } catch {
      // 静默
    }
  }, []);

  const captureOriginalTitle = useCallback(() => {
    if (originalTitleRef.current === null) {
      try {
        originalTitleRef.current = document.title;
      } catch {
        // 静默
      }
    }
  }, []);

  const clearTitleTimer = useCallback(() => {
    if (titleTimerRef.current !== null) {
      window.clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
  }, []);

  const restoreTitle = useCallback(() => {
    clearTitleTimer();
    if (originalTitleRef.current !== null) {
      setDocumentTitle(originalTitleRef.current);
      originalTitleRef.current = null;
    }
  }, [clearTitleTimer, setDocumentTitle]);

  const flashTitle = useCallback(
    (text: string) => {
      captureOriginalTitle();
      clearTitleTimer();
      setDocumentTitle(text);
      flashUntilRef.current = Date.now() + 1500; // 闪烁期间暂停倒计时标题，避免被立刻覆盖
      titleTimerRef.current = window.setTimeout(() => restoreTitle(), 5000);
    },
    [captureOriginalTitle, clearTitleTimer, restoreTitle, setDocumentTitle]
  );

  const updateCountdownTitle = useCallback(
    (ms: number, mode: PomodoroMode) => {
      captureOriginalTitle();
      clearTitleTimer();
      setDocumentTitle(`${formatMs(ms)} · ${MODE_LABEL[mode]}`);
    },
    [captureOriginalTitle, clearTitleTimer, setDocumentTitle]
  );

  const commit = useCallback((next: PomodoroState) => {
    stateRef.current = next;
    persistStateRef.current?.(next);
    setState(next);
  }, []);

  const totalMs = settings[MODE_MINUTES[state.mode]] * 60_000;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;

  const finishCurrent = useCallback(() => {
    const prev = stateRef.current;
    const conf = settingsRef.current;
    if (prev.mode === "focus") {
      const count = prev.completedFocus + 1;
      const seconds = prev.focusSeconds + conf.focusMinutes * 60;
      const nextMode: PomodoroMode =
        count % conf.longBreakInterval === 0 ? "longBreak" : "shortBreak";
      const nextTotal = conf[MODE_MINUTES[nextMode]] * 60_000;
      handlersRef.current?.onFocusCompleted?.(count, seconds);
      applyRemaining(nextTotal);
      commit({
        ...prev,
        mode: nextMode,
        completedFocus: count,
        focusSeconds: seconds,
        running: conf.autoSwitch,
        endAt: conf.autoSwitch ? Date.now() + nextTotal : null,
      });
    } else {
      const nextMode: PomodoroMode = "focus";
      const nextTotal = conf.focusMinutes * 60_000;
      handlersRef.current?.onBreakCompleted?.();
      applyRemaining(nextTotal);
      commit({
        ...prev,
        mode: nextMode,
        running: conf.autoSwitch,
        endAt: conf.autoSwitch ? Date.now() + nextTotal : null,
      });
    }
  }, [applyRemaining, commit]);

  useEffect(() => {
    if (!state.running || !state.endAt) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, (stateRef.current.endAt ?? 0) - Date.now());
      remainingRef.current = left;
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(timer);
        const finishedMode = stateRef.current.mode;
        flashTitle(
          finishedMode === "focus"
            ? "⏰ 专注完成，休息一下吧"
            : "休息结束，开始新一轮专注"
        );
        finishCurrent();
      } else if (Date.now() >= flashUntilRef.current) {
        updateCountdownTitle(left, stateRef.current.mode);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [state.running, state.endAt, finishCurrent, flashTitle, updateCountdownTitle]);

  // 组件卸载时还原标题
  useEffect(
    () => () => {
      restoreTitle();
    },
    [restoreTitle]
  );

  const start = useCallback(() => {
    const total = remainingRef.current;
    const mode = stateRef.current.mode;
    captureOriginalTitle();
    clearTitleTimer();
    setDocumentTitle(`${formatMs(total)} · ${MODE_LABEL[mode]}`);
    commit({ ...stateRef.current, running: true, endAt: Date.now() + total });
  }, [captureOriginalTitle, clearTitleTimer, commit, setDocumentTitle]);

  const pause = useCallback(() => {
    restoreTitle();
    commit({ ...stateRef.current, running: false });
  }, [commit, restoreTitle]);

  const reset = useCallback(() => {
    restoreTitle();
    const total = settingsRef.current.focusMinutes * 60_000;
    applyRemaining(total);
    commit({ ...stateRef.current, mode: "focus", running: false, endAt: null });
  }, [applyRemaining, commit, restoreTitle]);

  const switchMode = useCallback(
    (mode: PomodoroMode) => {
      restoreTitle();
      const total = settingsRef.current[MODE_MINUTES[mode]] * 60_000;
      applyRemaining(total);
      commit({ ...stateRef.current, mode, running: false, endAt: null });
    },
    [applyRemaining, commit, restoreTitle]
  );

  const skip = useCallback(() => {
    restoreTitle();
    const conf = settingsRef.current;
    const prev = stateRef.current;
    const nextMode: PomodoroMode =
      prev.mode === "focus"
        ? (prev.completedFocus + 1) % conf.longBreakInterval === 0
          ? "longBreak"
          : "shortBreak"
        : "focus";
    const total = conf[MODE_MINUTES[nextMode]] * 60_000;
    applyRemaining(total);
    commit({ ...prev, mode: nextMode, running: false, endAt: null });
  }, [applyRemaining, commit, restoreTitle]);

  const finish = useCallback(() => {
    const prev = stateRef.current;
    flashTitle(
      prev.mode === "focus"
        ? "⏰ 专注完成，休息一下吧"
        : "休息结束，开始新一轮专注"
    );
    finishCurrent();
  }, [finishCurrent, flashTitle]);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      persistSettingsRef.current?.(next);
      setSettings(next);
      if (!stateRef.current.running) {
        const total = next[MODE_MINUTES[stateRef.current.mode]] * 60_000;
        applyRemaining(total);
      }
    },
    [applyRemaining]
  );

  const setCurrentTodo = useCallback(
    (id?: string) => {
      commit({ ...stateRef.current, currentTodoId: id });
    },
    [commit]
  );

  return {
    state,
    settings,
    updateSettings,
    remainingMs,
    totalMs,
    progress,
    start,
    pause,
    reset,
    switchMode,
    skip,
    finish,
    setCurrentTodo,
  };
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
