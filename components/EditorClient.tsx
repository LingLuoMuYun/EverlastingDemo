"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IMPORT_SESSION_KEY, KIND_LABELS, type MarkdownImportPayload, type NoteKind } from "../lib/types";
import { useToast } from "./ToastProvider";
import ImportDialog from "./ImportDialog";

type NoteLike = {
  slug: string;
  kind?: NoteKind;
  title?: string;
  date?: string;
  updated?: string;
  description?: string;
  cover?: string;
  tags?: string[];
  mood?: string;
  location?: string;
  draft?: boolean;
  content?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseList(text: string): string[] {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 北京标准时间（UTC+8，不随机器时区变化）→ datetime-local 字符串 */
function toBeijingDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}T${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}

function nowBeijingDateTimeInput(): string {
  return toBeijingDateTimeInput(new Date());
}

/** 兼容 note.date 的各种写法（YYYY-MM-DD / YYYY-MM-DD HH:MM），统一成 datetime-local 值 */
function toDateTimeInput(value: string | undefined): string {
  if (!value) return nowBeijingDateTimeInput();
  const v = value.trim().replace(" ", "T");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : `${v.slice(0, 10)}T00:00`;
}

function clientGenerateSlug(title: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const latin = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return latin ? `${prefix}-${latin}` : `${prefix}-note-${Date.now().toString(36)}`;
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function EditorClient(
  props:
    | { mode: "list"; notes: NoteLike[]; autoPush?: boolean; embedded?: boolean }
    | { mode: "edit"; note: NoteLike | null; initialMtime?: number | null; allSlugs?: string[]; autoPush?: boolean; embedded?: boolean }
) {
  if (props.mode === "list") {
    return <EditorList notes={props.notes} autoPush={props.autoPush} embedded={props.embedded} />;
  }
  return (
    <EditorForm
      note={props.note}
      initialMtime={props.initialMtime ?? null}
      allSlugs={props.allSlugs || []}
      autoPush={props.autoPush}
      embedded={props.embedded}
    />
  );
}

function EditorList({ notes, autoPush, embedded }: { notes: NoteLike[]; autoPush?: boolean; embedded?: boolean }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className={`w-full max-w-5xl mx-auto px-4 sm:px-10 py-8 relative z-10 ${embedded ? "pt-2 md:pt-2" : "pt-24 md:pt-28"}`}>
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">本地编辑器</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            笔记列表（含草稿）· 保存只写本地文件，需 git push 才会发布
          </p>
          {autoPush && (
            <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 font-bold mt-1">
              自动推送已开启：每次保存后自动 git commit + push 到 GitHub（AUTO_PUSH=0 可关闭）
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border border-white/40 dark:border-white/10 text-sm font-black shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            导入
          </button>
          <Link
            href="/admin/notes/new"
            className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors"
          >
            + 新建笔记
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {notes.length === 0 && (
          <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
            还没有笔记，点右上角「新建笔记」开始吧。
          </div>
        )}
        {notes.map((note) => (
          <Link
            key={note.slug}
            href={`/admin/notes/${note.slug}`}
            className="group rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-md hover:shadow-xl transition-all p-4 md:p-5 flex items-center gap-4"
          >
            <span className="w-2 h-2 shrink-0 rounded-full bg-indigo-500"></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm md:text-base font-black text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {note.title || note.content?.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "") || note.slug}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 font-bold mt-1">
                {note.slug} · {note.date}
                {note.updated && note.updated !== note.date ? ` · 更新 ${note.updated}` : ""}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {note.draft && (
                <span className="text-[9px] md:text-[10px] font-black px-2 py-1 rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  草稿
                </span>
              )}
              <span className="text-[9px] md:text-[10px] font-black px-2 py-1 rounded-md border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10">
                {note.kind ? KIND_LABELS[note.kind] : "未知"}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function EditorForm({ note, initialMtime, allSlugs, autoPush, embedded }: { note: NoteLike | null; initialMtime: number | null; allSlugs: string[]; autoPush?: boolean; embedded?: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isNew = !note;

  // 列表页「导入」的解析结果：挂载后从 sessionStorage 读取并立即清除（避免 SSR 水合差异）
  const [importPayload, setImportPayload] = useState<MarkdownImportPayload | null>(null);
  const importPendingRef = useRef(false);

  const [kind, setKind] = useState<NoteKind>(note?.kind || "article");
  const [title, setTitle] = useState(note?.title || "");
  // 新建笔记默认当前北京标准时间（UTC+8）；编辑沿用已有 date
  const [date, setDate] = useState(() => toDateTimeInput(note?.date));
  const [description, setDescription] = useState(note?.description || "");
  const [cover, setCover] = useState(note?.cover || "");
  const [tagsText, setTagsText] = useState(note?.tags?.join(", ") || "");
  const [mood, setMood] = useState(note?.mood || "");
  const [location, setLocation] = useState(note?.location || "");
  const [draft, setDraft] = useState(Boolean(note?.draft));
  // slugTouched 保持 false：导入的 slugHint 可被后续改标题自动重新生成
  const [slug, setSlug] = useState(note?.slug || "");
  const [content, setContent] = useState(note?.content || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(note?.slug));

  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  /** 图片栏展示列表：本次会话上传的图片 */
  const imageList = uploadedImages;

  const storageKey = `note-unsaved:${note?.slug || "new"}`;

  // 导入预填：读取 sessionStorage 一次并立即清除（须在草稿恢复之前执行）
  useEffect(() => {
    if (typeof window === "undefined") return;
    let payload: MarkdownImportPayload | null = null;
    try {
      const raw = sessionStorage.getItem(IMPORT_SESSION_KEY);
      if (raw) {
        sessionStorage.removeItem(IMPORT_SESSION_KEY);
        const parsed = JSON.parse(raw) as MarkdownImportPayload;
        if (parsed && typeof parsed.content === "string") payload = parsed;
      }
    } catch {
      /* ignore */
    }
    if (!payload) return;
    importPendingRef.current = true;
    setImportPayload(payload);
    setKind(payload.kind);
    setTitle(payload.title || "");
    setDate(toDateTimeInput(payload.date));
    setDescription(payload.description || "");
    setCover(payload.cover || "");
    setTagsText(payload.tags?.join(", ") || "");
    setMood(payload.mood || "");
    setLocation(payload.location || "");
    setDraft(Boolean(payload.draft));
    setSlug(payload.slugHint || "");
    setContent(payload.content);
    showToast(`已从「${payload.sourceName}」导入，确认后保存`, "success");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 恢复本地未保存草稿（自动保存）
  useEffect(() => {
    // 导入预填优先：不覆盖为旧的本地草稿
    if (importPendingRef.current) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.content === "string" && parsed.content !== content) {
          setContent(parsed.content);
          setTitle(parsed.title || title);
          showToast("已恢复本地未保存的草稿内容", "success");
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动保存到 localStorage（防抖）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ title, content }));
      } catch {
        /* ignore */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [title, content, storageKey]);

  // 实时预览（防抖调服务端同一渲染管线）
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      if (!content.trim()) {
        setPreviewHtml("");
        return;
      }
      try {
        const res = await fetch("/api/notes/render", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ content }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewHtml(data.html || "");
        }
      } catch {
        /* preview failure is non-fatal */
      }
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [content]);

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(clientGenerateSlug(v));
  };

  const validate = (): string | null => {
    if (!SLUG_RE.test(slug)) return "slug 只能包含小写字母/数字/中划线";
    if (!date) return "请填写日期";
    if (kind === "article" && !title.trim()) return "文章需要标题";
    if (isNew && allSlugs.includes(slug)) return "slug 已存在，请换一个";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      showToast(err, "error");
      return;
    }
    setSaving(true);
    try {
      const data = {
        kind,
        title: title.trim() || undefined,
        date: date.replace("T", " "),
        description: description.trim() || undefined,
        cover: cover.trim() || undefined,
        tags: parseList(tagsText),
        mood: mood.trim() || undefined,
        location: location.trim() || undefined,
        draft,
      };
      const payload = {
        slug,
        data,
        content,
        ...(isNew ? {} : { expectedMtime: initialMtime ?? undefined }),
      };
      const res = await fetch("/api/notes", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        showToast("文件已在其他地方被修改，请刷新后重试（已保留你的草稿）", "error");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "保存失败", "error");
        return;
      }
      const result = await res.json().catch(() => ({}));
      localStorage.removeItem(storageKey);
      if (result.push?.ok) {
        showToast(isNew ? "已创建并推送到 GitHub" : "已保存并推送到 GitHub", "success");
      } else if (result.push && !result.push.ok) {
        showToast(`已${isNew ? "创建" : "保存"}，但推送失败：${result.push.error || "未知错误"}`, "error");
      } else {
        showToast(isNew ? "已创建笔记（记得 git push 发布）" : "已保存（记得 git push 发布）", "success");
      }
      router.push("/admin/notes");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S 保存（在 handleSave 声明之后注册，避免访问顺序问题）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, title, date, description, cover, tagsText, mood, location, draft, slug, content]);

  const handleDelete = async () => {
    if (!isNew && !window.confirm(`确定删除 ${slug} 吗？git 可恢复。`)) return;
    setDeleting(true);
    try {
      if (isNew) {
        localStorage.removeItem(storageKey);
        router.push("/admin/notes");
        return;
      }
      const res = await fetch(`/api/notes?slug=${encodeURIComponent(slug)}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        showToast("删除失败", "error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      localStorage.removeItem(storageKey);
      if (data.push?.ok) showToast("已删除并推送到 GitHub", "success");
      else if (data.push && !data.push.ok) showToast(`已删除，但推送失败：${data.push.error || "未知错误"}`, "error");
      else showToast("已删除", "success");
      router.push("/admin/notes");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  /** 上传图片到 public/uploads/notes（仅本地 dev），成功后插入 Markdown 并同步图片列表 */
  const handleUploadImages = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      showToast("未识别到图片文件", "error");
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/notes/upload", {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.error || "上传失败", "error");
          continue;
        }
        const url = String(data.url || "");
        if (!url) continue;
        const alt = (file.name.replace(/\.[^.]+$/, "") || "图片").replace(/["[\]]/g, "");
        insertIntoContent(`![${alt}](${url})`);
        setUploadedImages((prev) => [...prev, url]);
        showToast(`已上传 ${file.name}，可在图片栏点击重新插入`, "success");
      }
    } finally {
      setUploading(false);
    }
  };

  /** 在 Markdown 光标处插入片段 */
  const insertIntoContent = (text: string) => {
    const el = contentRef.current;
    if (!el) {
      setContent((c) => `${c}\n${text}\n`);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const suffix = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
    const next = `${before}${prefix}${text}${suffix}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      const cursor = before.length + prefix.length + text.length + suffix.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  /** 从图片栏移除（只影响本会话列表，不删除磁盘文件） */
  const removeImage = (url: string) => {
    setUploadedImages((prev) => prev.filter((u) => u !== url));
  };

  /** 点击图片栏缩略图，把图片插入正文光标处 */
  const insertImage = (url: string) => {
    const name = url.split("/").pop()?.replace(/\.[^.]+$/, "") || "图片";
    insertIntoContent(`![${name}](${url})`);
    showToast("已插入到光标处", "success");
  };

  /** 把图片栏里的图片设为封面图 */
  const setAsCover = (url: string) => {
    setCover(url);
    showToast("已设为封面图", "success");
  };

  const backLink = (
    <Link href="/admin/notes" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
      ← 返回列表
    </Link>
  );

  return (
    <div className={`w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 relative z-10 ${embedded ? "pt-2 md:pt-2" : "pt-24 md:pt-28"}`}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          {backLink}
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-2">
            {isNew ? "新建笔记" : `编辑：${slug}`}
          </h1>
          {isNew && importPayload && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-black px-2.5 py-1 rounded-full border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
              已导入：{importPayload.sourceName}
            </span>
          )}
          {autoPush && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-black px-2.5 py-1 rounded-full border bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              自动推送已开启：保存后自动 push 到 GitHub
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-sm font-black hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {deleting ? "删除中..." : "删除"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存 (Ctrl+S)"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>类型</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)} className={inputCls}>
                <option value="article">文章</option>
                <option value="talk">杂谈</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>日期时间</label>
              <div className="flex gap-2">
                <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                <button
                  type="button"
                  onClick={() => setDate(nowBeijingDateTimeInput())}
                  className="shrink-0 px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-black hover:bg-indigo-500/20 transition-colors"
                  title="设为当前本地时间"
                >
                  现在
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">新建笔记默认当前北京标准时间（UTC+8）</p>
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>标题（杂谈可留空，自动取正文首行）</label>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="标题" className={inputCls} />
          </div>
          <div className="mt-4">
            <label className={labelCls}>Slug（文件名，保存后不可随意改）</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              placeholder="yyyy-mm-dd-english-title"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div className="mt-4">
            <label className={labelCls}>标签（逗号分隔）</label>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="日常, 博客" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className={labelCls}>心情（杂谈）</label>
              <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="开心" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>定位（杂谈）</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="北京" className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>封面图 URL</label>
            <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." className={inputCls} />
            {cover ? (
              <div className="relative mt-2">
                <img
                  src={cover}
                  alt="封面图预览"
                  referrerPolicy="no-referrer"
                  className="w-full h-28 object-cover rounded-xl border border-white/30 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => setCover("")}
                  className="absolute top-1.5 right-1.5 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-black hover:bg-black/80 transition-colors"
                >
                  清除
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <label className={labelCls}>摘要（留空取正文前 100 字）</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
          </div>
          <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
            <span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300">草稿（前台不可见）</span>
          </label>
        </div>

        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-5 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">实时预览</h3>
            <span className="text-[10px] text-slate-400 font-bold">与服务端同一渲染管线</span>
          </div>
          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none flex-1 overflow-y-auto max-h-[520px] text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-slate-400 italic">在左侧输入 Markdown 开始预览...</p>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-5 mb-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleUploadImages(e.dataTransfer.files);
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.items || [])
            .filter((i) => i.kind === "file")
            .map((i) => i.getAsFile())
            .filter((f): f is File => f !== null);
          if (files.length) {
            e.preventDefault();
            handleUploadImages(files);
          }
        }}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">图片栏</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold">文件管理器选择 / 拖拽 / Ctrl+V 粘贴即可上传</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-black hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
            >
              {uploading ? "上传中..." : "从文件管理器选择"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleUploadImages(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {imageList.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            还没有图片。选择本地图片、拖拽图片或直接 Ctrl+V 粘贴截图，会自动上传到 public/uploads/notes 并在光标处插入。
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {imageList.map((url) => (
              <div
                key={url}
                onClick={() => insertImage(url)}
                title="点击插入正文"
                className={`group relative w-24 h-24 rounded-xl overflow-hidden border shadow-md bg-slate-200 dark:bg-slate-700 cursor-pointer transition-all ${
                  cover === url
                    ? "ring-2 ring-indigo-500 border-indigo-400 dark:border-indigo-400"
                    : "border-white/30 dark:border-white/10"
                }`}
              >
                <img src={url} alt="图片" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                {cover === url && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-indigo-500 text-white text-[9px] font-black">
                    封面
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(url);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="从列表移除（不删除文件）"
                >
                  ×
                </button>
                <span className="absolute bottom-0 inset-x-0 flex gap-1 p-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      insertImage(url);
                    }}
                    className="flex-1 rounded bg-white/20 text-white text-[9px] font-black py-0.5 hover:bg-white/40 transition-colors"
                    title="插入正文"
                  >
                    插入
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAsCover(url);
                    }}
                    className="flex-1 rounded bg-indigo-500/90 text-white text-[9px] font-black py-0.5 hover:bg-indigo-400 transition-colors"
                    title="设为封面图"
                  >
                    封面
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleUploadImages(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Markdown 源码</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold">自动保存草稿 · 正文中 Ctrl+V 粘贴图片可直接插入</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-black hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
            >
              {uploading ? "上传中..." : "上传图片"}
            </button>
          </div>
        </div>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData?.items || [])
              .filter((i) => i.kind === "file")
              .map((i) => i.getAsFile())
              .filter((f): f is File => f !== null);
            if (files.length) {
              e.preventDefault();
              handleUploadImages(files);
            }
          }}
          rows={16}
          placeholder="正文 Markdown..."
          className="w-full bg-slate-950/80 dark:bg-slate-950/90 text-slate-100 border border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-y"
        />
      </div>
    </div>
  );
}
