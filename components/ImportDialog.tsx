"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMPORT_SESSION_KEY, type MarkdownImportPayload } from "../lib/types";
import { useToast } from "./ToastProvider";

const ACCEPT = ".md,.markdown,.mdown,.txt,text/markdown,text/plain";
const MAX_SIZE = 2 * 1024 * 1024; // 与服务端 /api/notes/import/parse 一致

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ImportTab = "file" | "feishu";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 先按 UTF-8（含 BOM）解码；出现替换字符时降级 GBK，覆盖常见中文编码文件 */
async function readTextWithEncodingFallback(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    const gbk = new TextDecoder("gbk").decode(buf);
    return gbk.includes("\uFFFD") ? utf8 : gbk;
  } catch {
    return utf8;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [tab, setTab] = useState<ImportTab>("file");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    payload: MarkdownImportPayload;
    sourceLabel: string;
    detail?: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 每次打开重置状态
  useEffect(() => {
    if (open) {
      setTab("file");
      setParsing(false);
      setError("");
      setResult(null);
      setDragging(false);
      setFeishuUrl("");
    }
  }, [open]);

  const parseFile = async (file: File) => {
    setParsing(true);
    setError("");
    setResult(null);
    try {
      if (file.size <= 0) {
        setError("文件为空");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("文件超过 2MB，请精简后重试");
        return;
      }
      const text = await readTextWithEncodingFallback(file);
      const res = await fetch("/api/notes/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text, filename: file.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "解析失败，请检查文件内容");
        return;
      }
      setResult({
        payload: data.payload as MarkdownImportPayload,
        sourceLabel: file.name,
        detail: formatBytes(file.size),
      });
    } catch {
      setError("读取文件失败，请重试");
    } finally {
      setParsing(false);
    }
  };

  const fetchFeishu = async () => {
    const url = feishuUrl.trim();
    if (!url) return;
    setParsing(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/notes/import/feishu", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "导入失败，请检查链接与权限");
        return;
      }
      const payload = data.payload as MarkdownImportPayload;
      setResult({ payload, sourceLabel: payload.sourceName || "飞书文档", detail: "飞书在线文档" });
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setParsing(false);
    }
  };

  const applyImport = () => {
    if (!result) return;
    try {
      sessionStorage.setItem(IMPORT_SESSION_KEY, JSON.stringify(result.payload));
    } catch {
      showToast("浏览器存储不可用，无法导入", "error");
      return;
    }
    onClose();
    router.push("/admin/notes/new?from=import");
  };

  if (!open) return null;

  const tabCls = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-xl text-sm font-black transition-colors ${
      active
        ? "bg-indigo-500 text-white shadow-lg"
        : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
    }`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">导入文章</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              解析后预填编辑器，确认无误再保存
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-black hover:bg-white dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setTab("file")} className={tabCls(tab === "file")}>
            本地 Markdown 文件
          </button>
          <button type="button" onClick={() => setTab("feishu")} className={tabCls(tab === "feishu")}>
            飞书在线文档
          </button>
        </div>

        {tab === "file" ? (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) parseFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                dragging
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white/40 dark:hover:bg-slate-800/40"
              }`}
            >
              <div className="text-3xl mb-2">📄</div>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                {parsing ? "解析中..." : "点击选择或拖拽文件到这里"}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">支持 .md / .markdown / .txt，最大 2MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) parseFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 p-4">
            <label className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
              飞书文档分享链接
            </label>
            <div className="flex gap-2">
              <input
                value={feishuUrl}
                onChange={(e) => setFeishuUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !parsing) fetchFeishu();
                }}
                placeholder="https://xxx.feishu.cn/docx/xxxxxxxx"
                className="flex-1 min-w-0 bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              <button
                onClick={fetchFeishu}
                disabled={parsing || !feishuUrl.trim()}
                className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {parsing ? "解析中..." : "解析"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-relaxed">
              支持 /docx/ 与 /wiki/ 链接（旧版 /docs/ 不支持）。首次使用需在文档右上角
              「… → …更多 → 添加文档应用」授权本应用。
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs font-black text-green-600 dark:text-green-400">解析成功</span>
              <span className="text-[10px] text-slate-400 font-bold ml-auto truncate">
                {result.sourceLabel} · {result.detail}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">标题</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium truncate" title={result.payload.title}>
                  {result.payload.title || "（空，杂谈可不填）"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">类型</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium">
                  {result.payload.kind === "article" ? "文章" : "杂谈"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">日期</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium">{result.payload.date}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">标签</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium truncate">
                  {result.payload.tags.length ? result.payload.tags.join("、") : "（无）"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">字数</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium">
                  {result.payload.content.length} 字符
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-slate-400 font-bold w-10 shrink-0">草稿</dt>
                <dd className="text-slate-700 dark:text-slate-200 font-medium">
                  {result.payload.draft ? "是" : "否"}
                </dd>
              </div>
            </dl>
            {result.payload.warnings?.length ? (
              <ul className="mt-2 space-y-1">
                {result.payload.warnings.map((w) => (
                  <li key={w} className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 text-sm font-black hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={applyImport}
            disabled={!result || parsing}
            className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            导入到编辑器
          </button>
        </div>
      </div>
    </div>
  );
}
