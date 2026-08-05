"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FolderKanban, GitFork, Pencil, Plus, Trash2, X } from "lucide-react";
import AutopushBanner, { type AutopushResult } from "./admin/AutopushBanner";
import { useToast } from "./ToastProvider";

interface AdminProject {
  id: string;
  name: string;
  description: string;
  icon: string;
  githubUrl: string;
  tags: string[];
  order: number;
  draft?: boolean;
}

interface FormState {
  name: string;
  description: string;
  icon: string;
  githubUrl: string;
  tagsText: string;
  draft: boolean;
}

const EMOJI_PRESETS = ["🚀", "💻", "🧠", "📊", "🛠️", "📦", "🎮", "🤖", "📚", "🔬", "🌐", "⚙️"];

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  icon: "",
  githubUrl: "",
  tagsText: "",
  draft: false,
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function splitTags(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function shortGithub(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "") || url;
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function ProjectsAdminClient() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/projects/library");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      showToast("读取项目失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const patchCreate = (patch: Partial<FormState>) => setCreateForm((f) => ({ ...f, ...patch }));
  const patchEdit = (patch: Partial<FormState>) => setEditForm((f) => ({ ...f, ...patch }));

  const saveCreate = async () => {
    const name = createForm.name.trim();
    if (!name) {
      showToast("请填写项目名称", "warning");
      return;
    }
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name,
          description: createForm.description,
          icon: createForm.icon,
          githubUrl: createForm.githubUrl,
          tags: splitTags(createForm.tagsText),
          draft: createForm.draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setPushResult(data.push);
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      showToast("项目已创建并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const startEdit = (p: AdminProject) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      description: p.description,
      icon: p.icon,
      githubUrl: p.githubUrl,
      tagsText: p.tags.join("，"),
      draft: Boolean(p.draft),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) {
      showToast("请填写项目名称", "warning");
      return;
    }
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          id: editingId,
          name,
          description: editForm.description,
          icon: editForm.icon,
          githubUrl: editForm.githubUrl,
          tags: splitTags(editForm.tagsText),
          draft: editForm.draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPushResult(data.push);
      setEditingId(null);
      showToast("已保存并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const removeProject = async (p: AdminProject) => {
    if (!window.confirm(`确定删除项目「${p.name}」？数据将写回 data/projects/library.json，已提交记录可在 git 历史恢复。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (editingId === p.id) setEditingId(null);
      showToast("项目已删除并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const moveProject = async (id: string, dir: -1 | 1) => {
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id, move: dir }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "排序失败");
      setPushResult(data.push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const renderFields = (form: FormState, patch: (p: Partial<FormState>) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      <div>
        <label className={labelCls}>项目名称 *</label>
        <input
          className={inputCls}
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例如 EverlastingDemo"
        />
      </div>
      <div>
        <label className={labelCls}>GitHub 链接</label>
        <input
          className={inputCls}
          value={form.githubUrl}
          onChange={(e) => patch({ githubUrl: e.target.value })}
          placeholder="https://github.com/username/repo"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>描述</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="一句话介绍这个项目..."
        />
      </div>
      <div>
        <label className={labelCls}>图标（emoji）</label>
        <input
          className={inputCls}
          value={form.icon}
          onChange={(e) => patch({ icon: e.target.value })}
          placeholder="🚀"
          maxLength={8}
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {EMOJI_PRESETS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => patch({ icon: emoji })}
              className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all border ${
                form.icon === emoji
                  ? "bg-indigo-500/20 border-indigo-500/50 scale-110"
                  : "bg-white/40 dark:bg-slate-800/40 border-white/20 dark:border-white/5 hover:bg-white/70 dark:hover:bg-slate-700/60"
              }`}
              title={`使用 ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>标签（逗号分隔）</label>
        <input
          className={inputCls}
          value={form.tagsText}
          onChange={(e) => patch({ tagsText: e.target.value })}
          placeholder="Next.js, TypeScript, 开源"
        />
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.draft}
            onChange={(e) => patch({ draft: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">草稿（前台隐藏）</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">项目管理</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            共 {projects.length} 个项目，保存后自动 git commit + push 发布
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setEditingId(null);
          }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500 text-white text-xs font-black hover:bg-indigo-600 transition-all shadow-md"
        >
          {showCreate ? <X size={15} /> : <Plus size={15} />}
          {showCreate ? "取消新建" : "新建项目"}
        </button>
      </div>

      <AutopushBanner result={pushResult} />

      {showCreate && (
        <div className="mb-5 rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 md:p-6">
          <h2 className="font-black text-slate-900 dark:text-white mb-4 text-sm tracking-widest uppercase">新建项目</h2>
          {renderFields(createForm, patchCreate)}
          <div className="flex gap-2 mt-5">
            <button
              onClick={saveCreate}
              className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-black hover:bg-indigo-600 transition-all shadow-md"
            >
              保存并推送
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setCreateForm(EMPTY_FORM);
              }}
              className="px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-white/80 dark:hover:bg-slate-600/60 transition-all border border-white/40 dark:border-white/10"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="mb-5 rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-indigo-500/40 shadow-lg p-5 md:p-6">
          <h2 className="font-black text-slate-900 dark:text-white mb-1 text-sm tracking-widest uppercase">编辑项目</h2>
          <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-4 font-mono">{editingId}</p>
          {renderFields(editForm, patchEdit)}
          <div className="flex gap-2 mt-5">
            <button
              onClick={saveEdit}
              className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-xs font-black hover:bg-indigo-600 transition-all shadow-md"
            >
              保存并推送
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-black hover:bg-white/80 dark:hover:bg-slate-600/60 transition-all border border-white/40 dark:border-white/10"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-sm">加载中...</div>
      ) : projects.length === 0 && !showCreate ? (
        <div className="py-16 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-center text-slate-500 dark:text-slate-400 font-medium">
          还没有项目，点击右上角「新建项目」添加第一个吧。
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p, i) => (
            <div
              key={p.id}
              className={`rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border shadow-md p-4 md:p-5 transition-colors ${
                editingId === p.id
                  ? "border-indigo-500/50"
                  : "border-white/50 dark:border-white/10"
              }`}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div className="w-11 h-11 md:w-12 md:h-12 shrink-0 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-2xl">
                  {p.icon || <FolderKanban size={22} className="text-indigo-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">{p.name}</h3>
                    {p.draft && (
                      <span className="text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        草稿
                      </span>
                    )}
                    {p.githubUrl && (
                      <a
                        href={p.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                      >
                        <GitFork size={12} />
                        {shortGithub(p.githubUrl)}
                      </a>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  )}
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] md:text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/15"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => moveProject(p.id, -1)}
                      disabled={i === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="上移"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveProject(p.id, 1)}
                      disabled={i === projects.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="下移"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeProject(p)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/40 transition-all"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
