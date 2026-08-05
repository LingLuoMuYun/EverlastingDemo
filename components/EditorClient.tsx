"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KIND_LABELS, type NoteKind } from "../lib/types";
import { useToast } from "./ToastProvider";

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
  images?: string[];
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
    | { mode: "list"; notes: NoteLike[] }
    | { mode: "edit"; note: NoteLike | null; initialMtime?: number | null; allSlugs?: string[] }
) {
  if (props.mode === "list") {
    return <EditorList notes={props.notes} />;
  }
  return (
    <EditorForm
      note={props.note}
      initialMtime={props.initialMtime ?? null}
      allSlugs={props.allSlugs || []}
    />
  );
}

function EditorList({ notes }: { notes: NoteLike[] }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-10 py-8 pt-24 md:pt-28 relative z-10">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">本地编辑器</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            笔记列表（含草稿）· 保存只写本地文件，需 git push 才会发布
          </p>
        </div>
        <Link
          href="/editor/new"
          className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors"
        >
          + 新建笔记
        </Link>
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
            href={`/editor/${note.slug}`}
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
    </div>
  );
}

function EditorForm({ note, initialMtime, allSlugs }: { note: NoteLike | null; initialMtime: number | null; allSlugs: string[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isNew = !note;

  const [kind, setKind] = useState<NoteKind>(note?.kind || "article");
  const [title, setTitle] = useState(note?.title || "");
  const [date, setDate] = useState((note?.date || new Date().toISOString().slice(0, 16)).replace(" ", "T"));
  const [description, setDescription] = useState(note?.description || "");
  const [cover, setCover] = useState(note?.cover || "");
  const [tagsText, setTagsText] = useState(note?.tags?.join(", ") || "");
  const [mood, setMood] = useState(note?.mood || "");
  const [location, setLocation] = useState(note?.location || "");
  const [imagesText, setImagesText] = useState(note?.images?.join(", ") || "");
  const [draft, setDraft] = useState(Boolean(note?.draft));
  const [slug, setSlug] = useState(note?.slug || "");
  const [content, setContent] = useState(note?.content || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(note?.slug));

  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `note-unsaved:${note?.slug || "new"}`;

  // 恢复本地未保存草稿（自动保存）
  useEffect(() => {
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
    if (kind !== "moment" && !title.trim()) return "文章/杂谈需要标题";
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
        title: kind === "moment" ? title.trim() || undefined : title.trim(),
        date: date.replace("T", " "),
        description: description.trim() || undefined,
        cover: cover.trim() || undefined,
        tags: parseList(tagsText),
        mood: mood.trim() || undefined,
        location: location.trim() || undefined,
        images: parseList(imagesText),
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
      localStorage.removeItem(storageKey);
      showToast(isNew ? "已创建笔记（记得 git push 发布）" : "已保存（记得 git push 发布）", "success");
      router.push("/editor");
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
  }, [kind, title, date, description, cover, tagsText, mood, location, imagesText, draft, slug, content]);

  const handleDelete = async () => {
    if (!isNew && !window.confirm(`确定删除 ${slug} 吗？git 可恢复。`)) return;
    setDeleting(true);
    try {
      if (isNew) {
        localStorage.removeItem(storageKey);
        router.push("/editor");
        return;
      }
      const res = await fetch(`/api/notes?slug=${encodeURIComponent(slug)}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok && res.status !== 204) {
        showToast("删除失败", "error");
        return;
      }
      localStorage.removeItem(storageKey);
      showToast("已删除", "success");
      router.push("/editor");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const backLink = (
    <Link href="/editor" className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
      ← 返回列表
    </Link>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 pt-24 md:pt-28 relative z-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          {backLink}
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter mt-2">
            {isNew ? "新建笔记" : `编辑：${slug}`}
          </h1>
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
                <option value="moment">说说</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>日期</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>标题（说说可留空，自动取正文首行）</label>
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
              <label className={labelCls}>心情（杂谈/说说）</label>
              <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="开心" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>定位（说说）</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="北京" className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>封面图 URL</label>
            <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." className={inputCls} />
          </div>
          <div className="mt-4">
            <label className={labelCls}>图片 URL（说说，逗号分隔）</label>
            <input value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder="https://a.jpg, https://b.jpg" className={inputCls} />
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

      <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Markdown 源码</h3>
          <span className="text-[10px] text-slate-400 font-bold">自动保存到浏览器草稿，Ctrl+S 正式保存</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="正文 Markdown..."
          className="w-full bg-slate-950/80 dark:bg-slate-950/90 text-slate-100 border border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-y"
        />
      </div>
    </div>
  );
}
