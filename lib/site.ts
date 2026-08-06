// lib/site.ts —— 站点配置数据层
// 唯一可编辑覆盖层：data/site/config.json；默认值仍在 siteConfig.ts，读取时深合并
// 后台 / API / 前台页面统一从这里读，仿 lib/friends.ts 的数据层模式
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";
import { siteConfig as DEFAULT_SITE_CONFIG } from "../siteConfig";
import { findSiteField, SITE_EDITABLE_KEYS, type SiteField, type SiteListItemType } from "./site-schema";

export const SITE_DIR = path.join(process.cwd(), "data", "site");
export const SITE_CONFIG_PATH = path.join(SITE_DIR, "config.json");

export type SiteConfig = typeof DEFAULT_SITE_CONFIG;

interface SiteConfigFile {
  version: number;
  updatedAt: string;
  values: Record<string, unknown>;
}

const CACHE_KEY = "site:config";

const URL_OR_PATH_RE = /^(https?:\/\/\S+|\/[^\s]*)$/i;
const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 点路径取值：getByPath({social:{github:"x"}}, "social.github") → "x" */
function getByPath(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/** 点路径写入（沿路径自动补对象） */
function setByPath(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cur[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function readOverlay(): SiteConfigFile {
  if (!fs.existsSync(SITE_CONFIG_PATH)) {
    return { version: 1, updatedAt: "", values: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, "utf8")) as Partial<SiteConfigFile>;
    const values = raw?.values && typeof raw.values === "object" && !Array.isArray(raw.values)
      ? (raw.values as Record<string, unknown>)
      : {};
    return {
      version: Number(raw?.version) || 1,
      updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : "",
      values,
    };
  } catch (err) {
    console.error("[site] config.json 解析失败，回退默认配置:", err);
    return { version: 1, updatedAt: "", values: {} };
  }
}

/** 默认值 + 覆盖值深合并（只合并白名单字段，缺失字段回退代码默认值） */
export function mergeSiteConfig(file?: SiteConfigFile): SiteConfig {
  const overlay = (file ?? readOverlay()).values;
  const merged = structuredClone(DEFAULT_SITE_CONFIG);
  for (const key of SITE_EDITABLE_KEYS) {
    const value = getByPath(overlay, key);
    if (value !== undefined) {
      setByPath(merged as unknown as Record<string, unknown>, key, value);
    }
  }
  return merged;
}

export function getSiteConfig(): SiteConfig {
  return getCached(CACHE_KEY, () => mergeSiteConfig());
}

/** 公开读取（当前无敏感字段，与完整配置一致；保留入口便于后续过滤） */
export function getPublicSiteConfig(): SiteConfig {
  return getSiteConfig();
}

function isUrlOrPath(value: unknown): boolean {
  return typeof value === "string" && URL_OR_PATH_RE.test(value.trim());
}

function isColor(value: unknown): boolean {
  return typeof value === "string" && COLOR_RE.test(value.trim());
}

function normalizeListItem(field: SiteField, value: unknown, itemType: SiteListItemType): string {
  if (typeof value !== "string") throw new Error(`${field.key}: 列表项应为字符串`);
  const item = value.trim();
  if (!item) throw new Error(`${field.key}: 列表项不能为空`);
  if (itemType === "color" && !isColor(item)) throw new Error(`${field.key}: 非法色值 ${item}`);
  if (itemType === "url-or-path" && !isUrlOrPath(item)) throw new Error(`${field.key}: 非法链接或路径 ${item}`);
  if (field.max && item.length > field.max) throw new Error(`${field.key}: 列表项超过 ${field.max} 字符`);
  return item;
}

function normalizeValue(field: SiteField, value: unknown): unknown {
  if (field.type === "switch") {
    if (typeof value !== "boolean") throw new Error(`${field.key}: 应为布尔值`);
    return value;
  }
  if (field.type === "list") {
    if (!Array.isArray(value)) throw new Error(`${field.key}: 应为数组`);
    const itemType = field.itemType ?? "text";
    const items = value.map((v) => normalizeListItem(field, v, itemType));
    if (field.minItems !== undefined && items.length < field.minItems) {
      throw new Error(`${field.key}: 至少 ${field.minItems} 项`);
    }
    if (field.maxItems !== undefined && items.length > field.maxItems) {
      throw new Error(`${field.key}: 最多 ${field.maxItems} 项`);
    }
    return items;
  }
  // text / textarea / url
  if (typeof value !== "string") throw new Error(`${field.key}: 应为字符串`);
  const text = value.trim();
  if (field.required && !text) throw new Error(`${field.key}: 必填`);
  if (field.max !== undefined && text.length > field.max) {
    throw new Error(`${field.key}: 超过 ${field.max} 字符`);
  }
  if (field.type === "url" && text && !isUrlOrPath(text)) {
    throw new Error(`${field.key}: 应为 http(s) 链接或本地 /path`);
  }
  return text;
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenKeys(value as Record<string, unknown>, dotKey));
    } else {
      out.push(dotKey);
    }
  }
  return out;
}

/** 保存：白名单过滤 + 类型/格式校验；未知字段或非法值直接抛错 */
export function saveSiteConfig(values: Record<string, unknown>): SiteConfig {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("values 应为对象");
  }
  const unknownKeys = flattenKeys(values).filter((key) => !SITE_EDITABLE_KEYS.includes(key));
  if (unknownKeys.length) {
    throw new Error(`未知配置字段: ${unknownKeys.join(", ")}`);
  }
  const clean: Record<string, unknown> = {};
  for (const key of SITE_EDITABLE_KEYS) {
    const value = getByPath(values, key);
    if (value === undefined) continue;
    const field = findSiteField(key);
    if (!field) throw new Error(`缺少字段定义: ${key}`);
    setByPath(clean, key, normalizeValue(field, value));
  }
  const file: SiteConfigFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    values: clean,
  };
  fs.mkdirSync(SITE_DIR, { recursive: true });
  fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(file, null, 2) + "\n", "utf8");
  clearCache(CACHE_KEY);
  return mergeSiteConfig(file);
}
