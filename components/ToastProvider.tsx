"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

// 定义全局可以调用的方法
interface ToastContextType {
  showToast: (
    text: string,
    type?: ToastType,
    action?: ToastAction,
    duration?: number
  ) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);
const DEFAULT_DURATION = 3000;

interface ToastMessage {
  text: string;
  type: ToastType;
  action?: ToastAction;
}

// 1. 导出 Provider 组件（注意这里是 export function，没有 default）
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState<ToastMessage | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setToastMsg(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (
      text: string,
      type: ToastType = 'success',
      action?: ToastAction,
      duration: number = DEFAULT_DURATION
    ) => {
      clearTimer();
      setToastMsg({ text, type, action });
      timerRef.current = window.setTimeout(
        () => setToastMsg(null),
        duration
      );
    },
    [clearTimer]
  );

  // 卸载时清理定时器,避免内存泄漏
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border
              ${toastMsg.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' : ''}
              ${toastMsg.type === 'warning' ? 'bg-amber-500/90 border-amber-400 text-white' : ''}
              ${toastMsg.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : ''}
              ${toastMsg.type === 'info' ? 'bg-indigo-500/90 border-indigo-400 text-white' : ''}
            `}
          >
            <span className="font-bold text-sm">{toastMsg.text}</span>
            {toastMsg.action && (
              <button
                type="button"
                onClick={() => {
                  toastMsg.action?.onClick();
                  dismiss();
                }}
                className="px-2.5 py-1 rounded-lg bg-white/25 hover:bg-white/40 text-white text-xs font-bold transition-colors shrink-0"
              >
                {toastMsg.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </ToastContext.Provider>
  );
}

// 2. 导出魔法钩子，让 ProfileCard 可以调用
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast 必须在 ToastProvider 内部使用");
  return context;
};
