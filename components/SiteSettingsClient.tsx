"use client";

// 站点配置管理：按 lib/site-schema.ts 的字段定义自动渲染分组表单
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import AutopushBanner, { type AutopushResult } from "./admin/AutopushBanner";
import { useToast } from "./ToastProvider";
import {
  SITE_EDITABLE_KEYS,
  SITE_FIELD_GROUPS,
  type SiteField,
  type SiteFieldGroup,
} from "../lib/site-schema";
import { siteConfig as DEFAULT_SITE_CONFIG } from "../siteConfig";

type FlatConfig = Record<string, unknown>;

function getByPath(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

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

function toFlat(config: Record<string, unknown>): FlatConfig {
  const flat: FlatConfig = {};
  for (const key of SITE_EDITABLE_KEYS) {
    const value = getByPath(config, key);
    if (value !== undefined) flat[key] = value;
  }
  return flat;
}

function toNested(flat: FlatConfig): Record<string, unknown> {
  const nested: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    setByPath(nested, key, value);
  }
  return nested;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";
const cardCls =
  "rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 md:p-6";

function ListEditor({
  field,
  value,
  onChange,
}: {
  field: SiteField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const update = (index: number, next: string) => {
    const copy = [...items];
    copy[index] = next;
    onChange(copy);
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, ""]);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className={inputCls}
            value={item}
            placeholder={field.itemType === "color" ? "#a18cd1" : "https://... 或 /path"}
            onChange={(e) => update(index, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="shrink-0 px-2.5 py-2 rounded-xl text-xs font-black text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
          >
            删除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={field.maxItems !== undefined && items.length >= field.maxItems}
        className="self-start px-3 py-1.5 rounded-xl text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + 添加
      </button>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: SiteField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "switch") {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded accent-indigo-500"
        />
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">开启</span>
      </label>
    );
  }
  if (field.type === "list") {
    return <ListEditor field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "color") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#a18cd1"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-white/40 dark:border-white/10 bg-transparent cursor-pointer"
        />
        <input
          className={inputCls}
          value={typeof value === "string" ? value : ""}
          placeholder="#a18cd1"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  const shared = {
    className: inputCls,
    value: typeof value === "string" ? value : "",
    placeholder: field.placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  if (field.type === "textarea") {
    return <textarea rows={3} {...shared} />;
  }
  return <input type={field.type === "url" ? "url" : "text"} {...shared} />;
}

function FieldGroupCard({ group, flat, patch }: { group: SiteFieldGroup; flat: FlatConfig; patch: (k: string, v: unknown) => void }) {
  return (
    <section className={cardCls}>
      <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white mb-4 tracking-tight">{group.title}</h2>
      <div className="flex flex-col gap-4">
        {group.fields.map((field) => {
          const value = flat[field.key];
          const defaultValue = getByPath(DEFAULT_SITE_CONFIG as unknown as Record<string, unknown>, field.key);
          const customized = !sameValue(value, defaultValue);
          return (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>{field.label}</label>
                {customized && (
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                    已自定义
                  </span>
                )}
              </div>
              <FieldControl field={field} value={value} onChange={(v) => patch(field.key, v)} />
              {field.help && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">{field.help}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SiteSettingsClient() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<FlatConfig>({});
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/site");
      if (!res.ok) throw new Error("读取失败");
      const data = (await res.json()) as Record<string, unknown>;
      setFlat(toFlat(data));
    } catch {
      showToast("读取站点配置失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patch = (key: string, value: unknown) => setFlat((f) => ({ ...f, [key]: value }));

  const save = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPushResult(data.push);
      setFlat(toFlat(data.config as Record<string, unknown>));
      showToast("站点配置已保存并推送", "success");
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => save(toNested(flat));

  const handleReset = async () => {
    if (!window.confirm("确定重置为代码默认值吗？自定义覆盖将被清除。")) return;
    await save({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm font-bold text-slate-500 dark:text-slate-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">站点配置</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            保存后写回 data/site/config.json 并自动推送发布；默认值来自 siteConfig.ts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-700/50 transition-colors"
          >
            <RotateCcw size={13} />
            重置为默认
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={13} />
            {saving ? "保存中..." : "保存并发布"}
          </button>
        </div>
      </div>

      <AutopushBanner result={pushResult} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {SITE_FIELD_GROUPS.map((group) => (
          <FieldGroupCard key={group.key} group={group} flat={flat} patch={patch} />
        ))}
      </div>
    </div>
  );
}
