"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadToolboxData,
  normalizeDay,
  saveToolboxData,
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
