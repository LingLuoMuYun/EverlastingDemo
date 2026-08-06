"use client";

// 站点配置 Provider：启动时从 /api/site 拉取合并后的配置（默认值 + data/site/config.json 覆盖值）
// 请求失败时回退 siteConfig.ts 默认值，保证前台不白屏
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { siteConfig as DEFAULT_SITE_CONFIG } from "../siteConfig";

export type SiteConfig = typeof DEFAULT_SITE_CONFIG;

const SiteConfigContext = createContext<SiteConfig>(DEFAULT_SITE_CONFIG);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site")
      .then((res) => {
        if (!res.ok) throw new Error(`bad status ${res.status}`);
        return res.json() as Promise<SiteConfig>;
      })
      .then((data) => {
        if (!cancelled && data && typeof data === "object") {
          setConfig({ ...DEFAULT_SITE_CONFIG, ...data });
        }
      })
      .catch(() => {
        // 拉取失败保持默认值
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}
