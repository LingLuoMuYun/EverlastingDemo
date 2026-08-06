// scripts/validate-site.mjs —— 校验 data/site/config.json（覆盖层结构、白名单键、类型/格式）
// 用法：node scripts/validate-site.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "data", "site", "config.json");

// 与 lib/site-schema.ts 的白名单保持一致（脚本无法直接 import TS）
const EDITABLE_KEYS = [
  "title",
  "authorName",
  "bio",
  "avatarUrl",
  "faviconUrl",
  "navTitle",
  "navSuffix",
  "navAfter",
  "useGradient",
  "themeColors",
  "bgImages",
  "social.github",
  "social.email",
  "social.qq",
  "chatterTitle",
  "chatterDescription",
];

const URL_OR_PATH_RE = /^(https?:\/\/\S+|\/[^\s]*)$/i;
const COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function flattenKeys(obj, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const dotKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenKeys(value, dotKey));
    } else {
      out.push(dotKey);
    }
  }
  return out;
}

function check(cond, message, errors) {
  if (!cond) errors.push(message);
}

const errors = [];

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("❌ 缺少 data/site/config.json");
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch (err) {
  console.error("❌ config.json 不是合法 JSON:", err.message);
  process.exit(1);
}

check(raw && typeof raw === "object", "config.json 顶层应为对象", errors);
if (raw && typeof raw === "object") {
  check(Number.isInteger(raw.version) && raw.version >= 1, "version 应为整数", errors);
  check(typeof raw.updatedAt === "string", "updatedAt 应为字符串", errors);

  const values = raw.values;
  check(values && typeof values === "object" && !Array.isArray(values), "values 应为对象", errors);
  if (values && typeof values === "object" && !Array.isArray(values)) {
    const unknown = flattenKeys(values).filter((key) => !EDITABLE_KEYS.includes(key));
    check(unknown.length === 0, `values 含白名单外字段: ${unknown.join(", ")}`, errors);

    for (const key of EDITABLE_KEYS) {
      const parts = key.split(".");
      let cur = values;
      let found = true;
      for (const part of parts) {
        if (cur && typeof cur === "object" && part in cur) cur = cur[part];
        else {
          found = false;
          break;
        }
      }
      if (!found) continue;

      if (key === "useGradient") {
        check(typeof cur === "boolean", `${key} 应为布尔值`, errors);
      } else if (key === "themeColors" || key === "bgImages") {
        const isColors = key === "themeColors";
        check(Array.isArray(cur), `${key} 应为数组`, errors);
        if (Array.isArray(cur)) {
          check(cur.every((v) => typeof v === "string"), `${key} 列表项应为字符串`, errors);
          check(
            cur.every((v) => (isColors ? COLOR_RE.test(v) : URL_OR_PATH_RE.test(v))),
            `${key} 含非法值（色值需 #hex，链接需 http(s) 或 /path）`,
            errors,
          );
        }
      } else if (key === "social.github" || key === "avatarUrl" || key === "faviconUrl") {
        check(typeof cur === "string" && (cur === "" || URL_OR_PATH_RE.test(cur)), `${key} 应为 http(s) 链接或本地 /path`, errors);
      } else {
        check(typeof cur === "string", `${key} 应为字符串`, errors);
      }
    }
  }
}

if (errors.length) {
  console.error("❌ 站点配置校验失败：");
  for (const message of errors) console.error("  - " + message);
  process.exit(1);
}

console.log("✅ 站点配置校验通过");
