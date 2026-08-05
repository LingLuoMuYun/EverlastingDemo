"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileUp,
  FolderPlus,
  List,
  Music2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
  duration?: number;
  tags: string[];
  collectionIds: string[];
  lyrics: { lrc?: string; tlyric?: string; yrc?: string | null } | null;
  addedAt?: string;
}

interface AdminCollection {
  id: string;
  name: string;
  cover?: string;
  order: number;
}

interface NeteasePreview extends AdminTrack {
  neteaseId: string;
  audioOk: boolean;
  audioType: string;
  audioSize: number;
}

interface PlaylistPreview {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  fetched: number;
  existingCount: number;
  tracks: Array<{ id: string; name: string; artist: string; album: string; duration?: number; exists: boolean }>;
}

interface ImportReport {
  playlist: { id: string; name: string; cover: string; trackCount: number };
  imported: unknown[];
  skipped: Array<{ id: string; name: string; reason: string }>;
  failed: Array<{ id: string; name: string; reason: string }>;
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

function parseTags(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function MusicAdminClient() {
  const { showToast } = useToast();
  const [tracks, setTracks] = useState<AdminTrack[]>([]);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);
  const [tab, setTab] = useState<"list" | "add">("list");
  const [addMethod, setAddMethod] = useState<"local" | "netease" | "playlist">("local");

  // 筛选 / 排序 / 批量
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "netease" | "local">("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all"); // all | none | colId
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sort, setSort] = useState<"order" | "title" | "artist" | "duration" | "addedAt">("order");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 歌单管理
  const [colManagerOpen, setColManagerOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // 本地上传
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ file: string; url: string; size: number; name: string } | null>(null);
  const [localForm, setLocalForm] = useState({ title: "", artist: "" });
  const [dragging, setDragging] = useState(false);

  // 网易云单曲预览
  const [neteaseId, setNeteaseId] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<NeteasePreview | null>(null);

  // 歌单导入
  const [playlistId, setPlaylistId] = useState("");
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistPreview | null>(null);
  const [importOpts, setImportOpts] = useState({ skipExisting: true, maxSongs: 50, collectionId: "", tags: "" });
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // 编辑
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    artist: "",
    album: "",
    cover: "",
    tags: "",
    lrc: "",
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/music/library");
      const data = await res.json();
      setTracks(data.tracks || []);
      setCollections(data.collections || []);
    } catch {
      showToast("读取曲库失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => t.tags?.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [tracks]);

  const filtered = useMemo(() => {
    let list = tracks;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (sourceFilter !== "all") list = list.filter((t) => t.source === sourceFilter);
    if (collectionFilter === "none") list = list.filter((t) => !t.collectionIds?.length);
    else if (collectionFilter !== "all") list = list.filter((t) => t.collectionIds?.includes(collectionFilter));
    if (tagFilter !== "all") list = list.filter((t) => t.tags?.includes(tagFilter));

    const sorted = [...list];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "zh"));
        break;
      case "artist":
        sorted.sort((a, b) => a.artist.localeCompare(b.artist, "zh") || a.title.localeCompare(b.title, "zh"));
        break;
      case "duration":
        sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
      case "addedAt":
        sorted.sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
        break;
      default:
        break; // order 已按曲库顺序
    }
    return sorted;
  }, [tracks, search, sourceFilter, collectionFilter, tagFilter, sort]);

  const putTrack = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch("/api/music/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "操作失败");
    return data.push as AutopushResult | undefined;
  };

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
        body: JSON.stringify({
          source: "local",
          file: uploaded.file,
          title: localForm.title.trim(),
          artist: localForm.artist.trim(),
          collectionId: importOpts.collectionId || undefined,
        }),
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
        body: JSON.stringify({
          source: "netease",
          neteaseId: preview.neteaseId,
          collectionId: importOpts.collectionId || undefined,
        }),
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

  const fetchPlaylistPreview = async () => {
    const id = playlistId.trim();
    if (!/^\d+$/.test(id)) {
      showToast("请输入数字网易云歌单 ID", "warning");
      return;
    }
    setPlaylistLoading(true);
    setPlaylistPreview(null);
    setImportReport(null);
    try {
      const res = await fetch(`/api/music/netease/playlist/preview?id=${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "预览失败");
      setPlaylistPreview(data);
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setPlaylistLoading(false);
    }
  };

  const runPlaylistImport = async () => {
    if (!playlistPreview) return;
    setImporting(true);
    setImportReport(null);
    try {
      const res = await fetch("/api/music/netease/playlist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          playlistId: playlistPreview.id,
          skipExisting: importOpts.skipExisting,
          maxSongs: importOpts.maxSongs,
          collectionId: importOpts.collectionId || undefined,
          tags: parseTags(importOpts.tags),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      setImportReport(data.report);
      setPushResult(data.push);
      showToast(
        `歌单导入完成：新增 ${data.report.imported.length}，跳过 ${data.report.skipped.length}，失败 ${data.report.failed.length}`,
        data.report.failed.length ? "warning" : "success"
      );
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setImporting(false);
    }
  };

  const moveTrack = async (id: string, dir: -1 | 1) => {
    const idx = tracks.findIndex((t) => t.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= tracks.length) return;
    try {
      const push = await putTrack(id, { order: target + 1 });
      await putTrack(tracks[target].id, { order: idx + 1 });
      setPushResult(push ?? null);
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
      tags: (t.tags || []).join(", "),
      lrc: t.lyrics?.lrc || "",
    });
  };

  const saveEdit = async (t: AdminTrack) => {
    try {
      const data = await putTrack(t.id, {
        title: editDraft.title.trim() || t.title,
        artist: editDraft.artist.trim() || t.artist,
        album: editDraft.album.trim(),
        cover: editDraft.cover.trim(),
        tags: parseTags(editDraft.tags),
        lyrics: { ...(t.lyrics ?? {}), lrc: editDraft.lrc },
      });
      setPushResult(data ?? null);
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
      const res = await fetch(
        `/api/music/library?id=${encodeURIComponent(t.id)}${withFile ? "&deleteFile=1" : ""}`,
        { method: "DELETE", headers: authHeaders() }
      );
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.every((t) => next.has(t.id));
      filtered.forEach((t) => (allSelected ? next.delete(t.id) : next.add(t.id)));
      return next;
    });
  };

  const batchAddToCollection = async (colId: string) => {
    try {
      let push: AutopushResult | undefined;
      for (const id of selected) {
        const t = tracks.find((x) => x.id === id);
        if (!t) continue;
        push = await putTrack(id, { collectionIds: [...new Set([...(t.collectionIds || []), colId])] });
      }
      setPushResult(push ?? null);
      showToast("已加入歌单并推送", "success");
      setSelected(new Set());
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const batchRemoveFromCollection = async (colId: string) => {
    try {
      let push: AutopushResult | undefined;
      for (const id of selected) {
        const t = tracks.find((x) => x.id === id);
        if (!t) continue;
        push = await putTrack(id, { collectionIds: (t.collectionIds || []).filter((c) => c !== colId) });
      }
      setPushResult(push ?? null);
      showToast("已移出歌单并推送", "success");
      setSelected(new Set());
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const batchSetTags = async () => {
    const input = window.prompt("为所选歌曲设置标签（逗号分隔，留空清除）");
    if (input === null) return;
    const tags = parseTags(input);
    try {
      let push: AutopushResult | undefined;
      for (const id of selected) {
        push = await putTrack(id, { tags });
      }
      setPushResult(push ?? null);
      showToast("已设置标签并推送", "success");
      setSelected(new Set());
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const batchDelete = async () => {
    if (!window.confirm(`确定删除选中的 ${selected.size} 首歌曲吗？（git 历史可恢复）`)) return;
    try {
      let push: AutopushResult | undefined;
      for (const id of selected) {
        const res = await fetch(`/api/music/library?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "删除失败");
        push = data.push;
      }
      setPushResult(push ?? null);
      showToast("已批量删除并推送", "success");
      setSelected(new Set());
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const addCollection = async () => {
    const name = newColName.trim();
    if (!name) {
      showToast("请输入歌单名称", "warning");
      return;
    }
    try {
      const res = await fetch("/api/music/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setPushResult(data.push);
      setNewColName("");
      showToast("歌单已创建并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const renameCollection = async (c: AdminCollection) => {
    if (!renameDraft.trim()) return;
    try {
      const res = await fetch("/api/music/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id: c.id, name: renameDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重命名失败");
      setPushResult(data.push);
      setRenamingCol(null);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const moveCollection = async (c: AdminCollection, dir: -1 | 1) => {
    const sorted = [...collections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === c.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[target];
    try {
      const put = async (id: string, order: number) => {
        const res = await fetch("/api/music/collections", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ id, order }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "排序失败");
        return data.push;
      };
      const push = await put(a.id, b.order);
      await put(b.id, a.order);
      setPushResult(push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const removeCollection = async (c: AdminCollection) => {
    if (!window.confirm(`确定删除歌单「${c.name}」吗？歌曲不会被删除，仅解除归属。`)) return;
    try {
      const res = await fetch(`/api/music/collections?id=${encodeURIComponent(c.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (collectionFilter === c.id) setCollectionFilter("all");
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

  const selectAllChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">音乐曲库</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            共 {tracks.length} 首 · {collections.length} 个歌单 · 本地文件 + 网易云混合
          </p>
        </div>
        <button
          onClick={() => {
            setTab(tab === "add" ? "list" : "add");
            setImportReport(null);
          }}
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
            {(
              [
                ["local", "本地文件", FileUp],
                ["netease", "网易云 ID", Music2],
                ["playlist", "网易云歌单", List],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setAddMethod(key)}
                className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-black text-xs transition-all ${
                  addMethod === key ? "bg-indigo-500 text-white shadow-md" : "text-slate-500"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {addMethod === "local" && (
            <div className="space-y-4">
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
                  if (file) handleUpload(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  dragging ? "border-indigo-500 bg-indigo-500/10" : "border-white/40 dark:border-white/15"
                }`}
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
          )}

          {addMethod === "netease" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="网易云歌曲 ID，如 1441758494"
                  value={neteaseId}
                  onChange={(e) => setNeteaseId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPreview()}
                />
                <button
                  onClick={fetchPreview}
                  disabled={previewing}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all disabled:opacity-60"
                >
                  <Search size={14} /> {previewing ? "查询中..." : "预览"}
                </button>
              </div>
              {preview && (
                <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 p-4 flex gap-4 items-start">
                  {preview.cover && <img src={preview.cover} alt="cover" className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-md" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate">{preview.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {preview.artist} · {preview.album} · {formatDuration(preview.duration)}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      歌词：{(preview.lyrics?.lrc || "").split("\n").filter(Boolean).slice(0, 2).join(" / ") || "无"}
                    </p>
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        preview.audioOk
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      }`}
                    >
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

          {addMethod === "playlist" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="网易云歌单 ID，如 3778678（网页歌单链接里的数字）"
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPlaylistPreview()}
                />
                <button
                  onClick={fetchPlaylistPreview}
                  disabled={playlistLoading}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all disabled:opacity-60"
                >
                  <Search size={14} /> {playlistLoading ? "拉取中..." : "预览歌单"}
                </button>
              </div>

              {playlistPreview && (
                <>
                  <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 p-4 flex gap-4 items-start">
                    {playlistPreview.cover && (
                      <img src={playlistPreview.cover} alt="cover" className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 dark:text-white truncate">{playlistPreview.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        共 {playlistPreview.trackCount} 首 · 本次拉取 {playlistPreview.fetched} 首 · 库内已有 {playlistPreview.existingCount} 首
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-1">
                        前 3 首：{playlistPreview.tracks.slice(0, 3).map((t) => t.name).join(" / ")}
                        {playlistPreview.tracks[0]?.exists ? "（含已存在标记）" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={importOpts.skipExisting}
                        onChange={(e) => setImportOpts({ ...importOpts, skipExisting: e.target.checked })}
                        className="accent-indigo-500"
                      />
                      跳过已存在
                    </label>
                    <div>
                      <label className={labelCls}>最多导入</label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        className={inputCls}
                        value={importOpts.maxSongs}
                        onChange={(e) => setImportOpts({ ...importOpts, maxSongs: Number(e.target.value) || 50 })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>加入歌单（可选）</label>
                      <select
                        className={inputCls}
                        value={importOpts.collectionId}
                        onChange={(e) => setImportOpts({ ...importOpts, collectionId: e.target.value })}
                      >
                        <option value="">不分组</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>标签（逗号分隔）</label>
                      <input
                        className={inputCls}
                        placeholder="夜间, 氛围"
                        value={importOpts.tags}
                        onChange={(e) => setImportOpts({ ...importOpts, tags: e.target.value })}
                      />
                    </div>
                  </div>

                  <button
                    onClick={runPlaylistImport}
                    disabled={importing}
                    className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all disabled:opacity-60"
                  >
                    {importing ? "导入中（逐首抓取歌词）..." : `导入 ${playlistPreview.fetched} 首`}
                  </button>

                  {importReport && (
                    <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 p-4 text-xs space-y-1">
                      <p className="font-black text-slate-800 dark:text-white">
                        导入报告：新增 {importReport.imported.length} · 跳过 {importReport.skipped.length} · 失败 {importReport.failed.length}
                      </p>
                      {importReport.failed.length > 0 && (
                        <div className="text-amber-600 dark:text-amber-400">
                          {importReport.failed.slice(0, 5).map((f) => (
                            <p key={f.id}>✗ {f.name}：{f.reason}</p>
                          ))}
                          {importReport.failed.length > 5 && <p>… 共 {importReport.failed.length} 条失败</p>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 筛选 / 排序工具栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="搜索标题 / 歌手 / 专辑 / 标签"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={`${inputCls} !w-auto`} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}>
          <option value="all">全部来源</option>
          <option value="netease">网易云</option>
          <option value="local">本地</option>
        </select>
        <select className={`${inputCls} !w-auto`} value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
          <option value="all">全部歌单</option>
          <option value="none">未分组</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className={`${inputCls} !w-auto`} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="all">全部标签</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
        <select className={`${inputCls} !w-auto`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="order">默认排序</option>
          <option value="title">按标题</option>
          <option value="artist">按歌手</option>
          <option value="duration">按时长</option>
          <option value="addedAt">按添加时间</option>
        </select>
        <button
          onClick={() => setColManagerOpen(!colManagerOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
            colManagerOpen ? "bg-indigo-500 text-white" : "bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10"
          }`}
        >
          <FolderPlus size={14} /> 歌单管理
        </button>
      </div>

      {/* 歌单管理面板 */}
      {colManagerOpen && (
        <div className="rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 mb-5">
          <h2 className="font-black text-slate-900 dark:text-white text-sm mb-3">歌单管理</h2>
          <div className="flex flex-col gap-2">
            {collections.length === 0 && (
              <p className="text-xs text-slate-400">还没有歌单，先创建一个用于给歌曲分组吧。</p>
            )}
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <button onClick={() => moveCollection(c, -1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 transition-all" title="上移">
                  <ArrowUp size={14} />
                </button>
                <button onClick={() => moveCollection(c, 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 transition-all" title="下移">
                  <ArrowDown size={14} />
                </button>
                {renamingCol === c.id ? (
                  <input
                    className={`${inputCls} !w-48`}
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && renameCollection(c)}
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex-1">{c.name}</span>
                )}
                {renamingCol === c.id ? (
                  <>
                    <button onClick={() => renameCollection(c)} className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white text-xs font-black">
                      保存
                    </button>
                    <button onClick={() => setRenamingCol(null)} className="px-2.5 py-1 rounded-lg bg-white/50 text-slate-500 text-xs font-black">
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setRenamingCol(c.id);
                      setRenameDraft(c.name);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 transition-all"
                    title="重命名"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button onClick={() => removeCollection(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-all" title="删除歌单">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              className={inputCls}
              placeholder="新歌单名称，如：通勤"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollection()}
            />
            <button onClick={addCollection} className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">
              <Plus size={14} /> 创建
            </button>
          </div>
        </div>
      )}

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/30 p-3 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-300 mr-1">已选 {selected.size} 首</span>
          <select
            className="!w-auto bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) batchAddToCollection(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              加入歌单…
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="!w-auto bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) batchRemoveFromCollection(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              移出歌单…
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={batchSetTags} className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/70 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-white transition-all">
            设置标签
          </button>
          <button onClick={batchDelete} className="px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-black hover:bg-red-600 transition-all">
            批量删除
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-500 hover:text-slate-700 transition-all">
            取消选择
          </button>
        </div>
      )}

      {/* 曲库列表 */}
      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
            {tracks.length === 0 ? "曲库为空，点击右上角「添加音乐」开始吧。" : "没有符合条件的歌曲，试试调整筛选。"}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-1 mb-1">
            <input type="checkbox" checked={selectAllChecked} onChange={toggleSelectAll} className="accent-indigo-500" title="全选当前筛选结果" />
            <span className="text-[11px] font-bold text-slate-400">全选（{filtered.length}）</span>
          </div>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-sm p-3.5">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggleSelect(t.id)}
                className="accent-indigo-500 shrink-0"
              />
              {t.cover ? (
                <img src={t.cover} alt="cover" className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-sm" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 shrink-0">
                  <Music2 size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black ${t.source === "netease" ? "bg-red-500/10 text-red-500" : "bg-indigo-500/10 text-indigo-500"}`}>
                    {t.source === "netease" ? "网易云" : "本地"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {t.artist} · {t.album} · {formatDuration(t.duration)}
                </p>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {(t.tags || []).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-500/10 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                      #{tag}
                    </span>
                  ))}
                  {(t.collectionIds || [])
                    .map((cid) => collections.find((c) => c.id === cid))
                    .filter(Boolean)
                    .map((c) => (
                      <span key={c!.id} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        ▣ {c!.name}
                      </span>
                    ))}
                </div>
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
                <div>
                  <label className={labelCls}>标签（逗号分隔）</label>
                  <input className={inputCls} value={editDraft.tags} onChange={(e) => setEditDraft({ ...editDraft, tags: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>加入歌单</label>
                  <select
                    className={inputCls}
                    value={t.collectionIds?.[0] || ""}
                    onChange={(e) => {
                      const colId = e.target.value;
                      try {
                        void putTrack(t.id, { collectionIds: colId ? [colId] : [] });
                        refresh();
                      } catch (err) {
                        showToast(String((err as Error).message || err), "error");
                      }
                    }}
                  >
                    <option value="">不分组</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>歌词（LRC）</label>
                  <textarea className={`${inputCls} h-28 font-mono text-xs`} value={editDraft.lrc} onChange={(e) => setEditDraft({ ...editDraft, lrc: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(t)} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">
                    保存
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl bg-white/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-sm font-black hover:bg-white/70 transition-all">
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
