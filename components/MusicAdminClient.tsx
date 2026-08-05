"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FileUp, Music2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AutopushBanner, { type AutopushResult } from "./admin/AutopushBanner";
import { useToast } from "./ToastProvider";

interface AdminTrack {
  id: string;
  source: "netease" | "local";
  title: string;
  artist: string;
  album: string;
  cover: string;
  src: string;
  lyrics: { lrc?: string; tlyric?: string; yrc?: string | null } | null;
}

interface NeteasePreview extends AdminTrack {
  neteaseId: string;
  audioOk: boolean;
  audioType: string;
  audioSize: number;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function MusicAdminClient() {
  const { showToast } = useToast();
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);
  const [tab, setTab] = useState<"list" | "add">("list");
  const [addMethod, setAddMethod] = useState<"local" | "netease">("local");

  // 本地上传
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ file: string; url: string; size: number; name: string } | null>(null);
  const [localForm, setLocalForm] = useState({ title: "", artist: "" });
  const [dragging, setDragging] = useState(false);

  // 网易云预览
  const [neteaseId, setNeteaseId] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<NeteasePreview | null>(null);

  // 编辑
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; artist: string; album: string; cover: string; lrc: string }>({
    title: "",
    artist: "",
    album: "",
    cover: "",
    lrc: "",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/music/library");
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch {
      showToast("读取曲库失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/music/upload", { method: "POST", headers: authHeaders(), body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      setUploaded(data);
      setLocalForm({ title: titleFromFilename(data.name || file.name), artist: "" });
      showToast("音频已上传，填写信息后加入曲库", "success");
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setUploading(false);
    }
  };

  const addLocalTrack = async () => {
    if (!uploaded) return;
    if (!localForm.title.trim()) {
      showToast("请填写歌名", "warning");
      return;
    }
    try {
      const res = await fetch("/api/music/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ source: "local", file: uploaded.file, title: localForm.title.trim(), artist: localForm.artist.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加入失败");
      setPushResult(data.push);
      setUploaded(null);
      setLocalForm({ title: "", artist: "" });
      setTab("list");
      showToast("已加入曲库并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const fetchPreview = async () => {
    const id = neteaseId.trim();
    if (!/^\d+$/.test(id)) {
      showToast("请输入数字网易云 ID", "warning");
      return;
    }
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await fetch(`/api/music/netease/preview?id=${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "预览失败");
      setPreview(data);
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setPreviewing(false);
    }
  };

  const addNeteaseTrack = async () => {
    if (!preview) return;
    try {
      const res = await fetch("/api/music/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ source: "netease", neteaseId: preview.neteaseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加入失败");
      setPushResult(data.push);
      setPreview(null);
      setNeteaseId("");
      setTab("list");
      showToast("已加入曲库并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const moveTrack = async (id: string, dir: -1 | 1) => {
    const sorted = [...tracks].sort((a, b) => orderOf(a, tracks) - orderOf(b, tracks));
    const idx = sorted.findIndex((t) => t.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[target];
    try {
      const put = async (trackId: string, order: number) => {
        const res = await fetch("/api/music/library", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ id: trackId, order }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "排序失败");
        return data.push;
      };
      const push = await put(a.id, orderOf(b, tracks));
      await put(b.id, orderOf(a, tracks));
      setPushResult(push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const startEdit = (t: AdminTrack) => {
    setEditingId(t.id);
    setEditDraft({
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover,
      lrc: t.lyrics?.lrc || "",
    });
  };

  const saveEdit = async (t: AdminTrack) => {
    try {
      const res = await fetch("/api/music/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          id: t.id,
          title: editDraft.title.trim() || t.title,
          artist: editDraft.artist.trim() || t.artist,
          album: editDraft.album.trim(),
          cover: editDraft.cover.trim(),
          lyrics: { ...(t.lyrics ?? {}), lrc: editDraft.lrc },
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

  const deleteTrack = async (t: AdminTrack, withFile: boolean) => {
    const msg = withFile
      ? `确定删除「${t.title}」并删除本地音频文件吗？（git 历史可恢复）`
      : `确定从曲库移除「${t.title}」吗？（git 历史可恢复）`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`/api/music/library?id=${encodeURIComponent(t.id)}${withFile ? "&deleteFile=1" : ""}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (editingId === t.id) setEditingId(null);
      showToast("已删除并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">音乐曲库</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            共 {tracks.length} 首 · 本地文件 + 网易云 ID 混合曲库
          </p>
        </div>
        <button
          onClick={() => setTab(tab === "add" ? "list" : "add")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-all"
        >
          {tab === "add" ? <X size={15} /> : <Plus size={15} />}
          {tab === "add" ? "返回列表" : "添加音乐"}
        </button>
      </div>

      <AutopushBanner result={pushResult} />

      {tab === "add" && (
        <div className="rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 md:p-6 mb-8">
          <div className="flex items-center gap-1 p-1 mb-5 bg-white/50 dark:bg-slate-900/50 rounded-full shadow-inner border border-white/40 w-fit">
            <button
              onClick={() => setAddMethod("local")}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-black text-xs transition-all ${addMethod === "local" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500"}`}
            >
              <FileUp size={13} /> 本地文件
            </button>
            <button
              onClick={() => setAddMethod("netease")}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-black text-xs transition-all ${addMethod === "netease" ? "bg-indigo-500 text-white shadow-md" : "text-slate-500"}`}
            >
              <Music2 size={13} /> 网易云 ID
            </button>
          </div>

          {addMethod === "local" ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleUpload(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${dragging ? "border-indigo-500 bg-indigo-500/10" : "border-white/40 dark:border-white/15"}`}
              >
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                  {uploading ? "上传中..." : "拖拽音频到这里，或点击选择"}
                </p>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.flac,.ogg,.wav"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }}
                  className="text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-indigo-500 file:text-white file:text-xs file:font-black file:cursor-pointer hover:file:bg-indigo-600"
                />
              </div>

              {uploaded && (
                <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 p-4">
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-3">
                    ✓ 已上传：{uploaded.name}（{(uploaded.size / 1024 / 1024).toFixed(1)}MB）→ /{uploaded.file}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={labelCls}>歌名 *</label>
                      <input className={inputCls} value={localForm.title} onChange={(e) => setLocalForm({ ...localForm, title: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>歌手</label>
                      <input className={inputCls} value={localForm.artist} onChange={(e) => setLocalForm({ ...localForm, artist: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={addLocalTrack} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">
                    加入曲库
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="网易云歌曲 ID，如 1441758494"
                  value={neteaseId}
                  onChange={(e) => setNeteaseId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPreview()}
                />
                <button onClick={fetchPreview} disabled={previewing} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all disabled:opacity-60">
                  <Search size={14} /> {previewing ? "查询中..." : "预览"}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">支持批量：逗号分隔多个 ID（将逐个预览）</p>

              {preview && (
                <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 p-4 flex gap-4 items-start">
                  {preview.cover && (
                    <img src={preview.cover} alt="cover" className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate">{preview.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{preview.artist} · {preview.album}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-1">歌词：{(preview.lyrics?.lrc || "").split("\n").filter(Boolean).slice(0, 2).join(" / ") || "无"}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black ${preview.audioOk ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                      {preview.audioOk ? "✓ 可播放" : "⚠ 可能下架/VIP 受限（可强制加入，播放器会自动跳过）"}
                    </span>
                  </div>
                  <button onClick={addNeteaseTrack} className="shrink-0 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">
                    加入曲库
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {tracks.length === 0 && (
          <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
            曲库为空，点击右上角「添加音乐」开始吧。
          </div>
        )}
        {tracks.map((t) => (
          <div key={t.id} className="rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm p-3.5">
            <div className="flex items-center gap-3">
              {t.cover ? (
                <img src={t.cover} alt="cover" className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-sm" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 shrink-0">
                  <Music2 size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {t.artist} · {t.album}
                </p>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black ${t.source === "netease" ? "bg-red-500/10 text-red-500" : "bg-indigo-500/10 text-indigo-500"}`}>
                  {t.source === "netease" ? "网易云" : "本地"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => moveTrack(t.id, -1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="上移">
                  <ArrowUp size={15} />
                </button>
                <button onClick={() => moveTrack(t.id, 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="下移">
                  <ArrowDown size={15} />
                </button>
                <button onClick={() => (editingId === t.id ? setEditingId(null) : startEdit(t))} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="编辑">
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteTrack(t, false)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/40 transition-all" title="删除">
                  <Trash2 size={15} />
                </button>
                {t.source === "local" && (
                  <button onClick={() => deleteTrack(t, true)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white/40 transition-all" title="删除并移除本地文件">
                    <Trash2 size={15} className="opacity-70" />
                  </button>
                )}
              </div>
            </div>

            {editingId === t.id && (
              <div className="mt-3 pt-3 border-t border-white/30 dark:border-white/10 grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>歌名</label>
                  <input className={inputCls} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>歌手</label>
                  <input className={inputCls} value={editDraft.artist} onChange={(e) => setEditDraft({ ...editDraft, artist: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>专辑</label>
                  <input className={inputCls} value={editDraft.album} onChange={(e) => setEditDraft({ ...editDraft, album: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>封面 URL</label>
                  <input className={inputCls} value={editDraft.cover} onChange={(e) => setEditDraft({ ...editDraft, cover: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>歌词（LRC）</label>
                  <textarea className={`${inputCls} h-28 font-mono text-xs`} value={editDraft.lrc} onChange={(e) => setEditDraft({ ...editDraft, lrc: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(t)} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">保存</button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-sm font-black hover:bg-white/70 transition-all">取消</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function orderOf(t: AdminTrack, tracks: AdminTrack[]): number {
  return tracks.indexOf(t);
}
