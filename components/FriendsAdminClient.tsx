"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Link as LinkIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import AutopushBanner, { type AutopushResult } from "./admin/AutopushBanner";
import { useToast } from "./ToastProvider";

interface AdminFriend {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  themeColor: string;
  status: "online" | "offline";
  order: number;
  draft?: boolean;
}

interface FormState {
  name: string;
  url: string;
  description: string;
  avatar: string;
  themeColor: string;
  status: "online" | "offline";
  draft: boolean;
}

const DEFAULT_COLOR = "#6366f1";

const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  description: "",
  avatar: "",
  themeColor: "",
  status: "online",
  draft: false,
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "友").toUpperCase();
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || url;
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function FriendsAdminClient() {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<AdminFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/friends/library");
      const data = await res.json();
      setFriends(data.friends || []);
    } catch {
      showToast("读取友链失败", "error");
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
    const url = createForm.url.trim();
    if (!name) {
      showToast("请填写友链名称", "warning");
      return;
    }
    if (!url) {
      showToast("请填写友链链接", "warning");
      return;
    }
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...createForm, name, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setPushResult(data.push);
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      showToast("友链已创建并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const startEdit = (f: AdminFriend) => {
    setEditingId(f.id);
    setEditForm({
      name: f.name,
      url: f.url,
      description: f.description,
      avatar: f.avatar,
      themeColor: f.themeColor,
      status: f.status,
      draft: Boolean(f.draft),
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editForm.name.trim();
    const url = editForm.url.trim();
    if (!name) {
      showToast("请填写友链名称", "warning");
      return;
    }
    if (!url) {
      showToast("请填写友链链接", "warning");
      return;
    }
    try {
      const res = await fetch("/api/friends", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id: editingId, ...editForm, name, url }),
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

  const removeFriend = async (f: AdminFriend) => {
    if (!window.confirm(`确定删除友链「${f.name}」？数据将写回 data/friends/library.json，已提交记录可在 git 历史恢复。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/friends?id=${encodeURIComponent(f.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (editingId === f.id) setEditingId(null);
      showToast("友链已删除并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const moveFriend = async (id: string, dir: -1 | 1) => {
    try {
      const res = await fetch("/api/friends", {
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

  const Avatar = ({ friend }: { friend: { avatar: string; name: string; themeColor: string } }) =>
    friend.avatar ? (
      <img
        src={friend.avatar}
        alt={friend.name}
        referrerPolicy="no-referrer"
        className="w-full h-full rounded-full object-cover bg-white"
      />
    ) : (
      <div
        className="w-full h-full rounded-full flex items-center justify-center text-white font-black"
        style={{ backgroundColor: friend.themeColor || DEFAULT_COLOR }}
      >
        {initialOf(friend.name)}
      </div>
    );

  const renderFields = (form: FormState, patch: (p: Partial<FormState>) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
      <div>
        <label className={labelCls}>站点名称 *</label>
        <input
          className={inputCls}
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="例如 泠落的小屋"
        />
      </div>
      <div>
        <label className={labelCls}>站点链接 *</label>
        <input
          className={inputCls}
          value={form.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://example.com"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>描述</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="一句话介绍这位朋友..."
        />
      </div>
      <div>
        <label className={labelCls}>头像链接</label>
        <input
          className={inputCls}
          value={form.avatar}
          onChange={(e) => patch({ avatar: e.target.value })}
          placeholder="https://.../avatar.png（留空用字母头像）"
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 shrink-0 overflow-hidden">
            <Avatar friend={{ avatar: form.avatar, name: form.name, themeColor: form.themeColor }} />
          </div>
          <span className="text-[10px] text-slate-400 font-bold">头像预览</span>
        </div>
      </div>
      <div>
        <label className={labelCls}>主题色（卡片光斑）</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(form.themeColor) ? form.themeColor : DEFAULT_COLOR}
            onChange={(e) => patch({ themeColor: e.target.value })}
            className="w-10 h-10 rounded-xl border border-white/40 dark:border-white/10 bg-transparent cursor-pointer"
          />
          <input
            className={inputCls}
            value={form.themeColor}
            onChange={(e) => patch({ themeColor: e.target.value })}
            placeholder="#6366f1"
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>状态</label>
        <select
          className={inputCls}
          value={form.status}
          onChange={(e) => patch({ status: e.target.value as "online" | "offline" })}
        >
          <option value="online">在线</option>
          <option value="offline">离线</option>
        </select>
      </div>
      <div>
        <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
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
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">友链管理</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            共 {friends.length} 条友链，保存后自动 git commit + push 发布
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
          {showCreate ? "取消新建" : "新建友链"}
        </button>
      </div>

      <AutopushBanner result={pushResult} />

      {showCreate && (
        <div className="mb-5 rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 md:p-6">
          <h2 className="font-black text-slate-900 dark:text-white mb-4 text-sm tracking-widest uppercase">新建友链</h2>
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
          <h2 className="font-black text-slate-900 dark:text-white mb-1 text-sm tracking-widest uppercase">编辑友链</h2>
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
      ) : friends.length === 0 && !showCreate ? (
        <div className="py-16 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-center text-slate-500 dark:text-slate-400 font-medium">
          还没有友链，点击右上角「新建友链」添加第一条吧。
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {friends.map((f, i) => (
            <div
              key={f.id}
              className={`rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border shadow-md p-4 md:p-5 transition-colors ${
                editingId === f.id ? "border-indigo-500/50" : "border-white/50 dark:border-white/10"
              }`}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div className="w-11 h-11 md:w-12 md:h-12 shrink-0 rounded-full p-[2px] md:p-[3px] bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 overflow-hidden">
                  <Avatar friend={f} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">{f.name}</h3>
                    <span
                      className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                        f.status === "offline"
                          ? "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20"
                          : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                      }`}
                    >
                      {f.status === "offline" ? "离线" : "在线"}
                    </span>
                    {f.draft && (
                      <span className="text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        草稿
                      </span>
                    )}
                    <span
                      className="w-3 h-3 rounded-full border border-white/40"
                      style={{ backgroundColor: f.themeColor || DEFAULT_COLOR }}
                      title={f.themeColor || DEFAULT_COLOR}
                    />
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <LinkIcon size={12} />
                      {shortUrl(f.url)}
                    </a>
                  </div>
                  {f.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mt-1">
                      {f.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => moveFriend(f.id, -1)}
                      disabled={i === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="上移"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveFriend(f.id, 1)}
                      disabled={i === friends.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="下移"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => startEdit(f)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all"
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => removeFriend(f)}
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
