"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadToolboxData,
  migrate,
  normalizeDay,
  saveToolboxData,
  STORAGE_KEY,
} from "./storage";
import type { ToolboxData } from "./types";

/** 共享数据层：读取/跨天归档/持久化，供工具箱各子页面复用 */
export function useToolboxData() {
  const [data, setData] = useState<ToolboxData | null>(null);

  useEffect(() => {
    const loaded = normalizeDay(loadToolboxData());
    saveToolboxData(loaded);
    setData(loaded);
  }, []);

  // 跨标签页同步:其他标签页写入时,本页实时刷新(单一数据源,防双开不同步)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = normalizeDay(migrate(JSON.parse(e.newValue)));
        setData(next);
      } catch {
        // 其他标签页写入坏数据时忽略,不影响当前页
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateData = useCallback(
    (updater: (d: ToolboxData) => ToolboxData) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveToolboxData(next);
        return next;
      });
    },
    []
  );

  return { data, updateData };
}
