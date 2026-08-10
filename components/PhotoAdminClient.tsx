"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Images, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import AutopushBanner, { type AutopushResult } from "./admin/AutopushBanner";
import { useToast } from "./ToastProvider";

interface AdminPhoto {
  id: string;
  url: string;
  caption?: string;
  takenAt?: string;
  order: number;
}

interface AdminAlbum {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  order: number;
  photos: AdminPhoto[];
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("editor_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  "w-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
const labelCls = "text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block";

export default function PhotoAdminClient() {
  const { showToast } = useToast();
  const [albums, setAlbums] = useState<AdminAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushResult, setPushResult] = useState<AutopushResult | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // 新建相册
  const [showCreate, setShowCreate] = useState(false);
  const [newAlbum, setNewAlbum] = useState({ title: "", date: today(), description: "" });

  // 编辑相册
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumDraft, setAlbumDraft] = useState({ title: "", date: "", description: "", cover: "" });

  // 编辑照片
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoDraft, setPhotoDraft] = useState({ caption: "", takenAt: "" });

  // 上传 / 拖拽
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/photos/library");
      const data = await res.json();
      setAlbums(data.albums || []);
    } catch {
      showToast("读取照片墙失败", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId) || null;

  const createAlbum = async () => {
    const title = newAlbum.title.trim();
    if (!title) {
      showToast("请填写相册标题", "warning");
      return;
    }
    try {
      const res = await fetch("/api/photos/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ title, date: newAlbum.date, description: newAlbum.description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setPushResult(data.push);
      setNewAlbum({ title: "", date: today(), description: "" });
      setShowCreate(false);
      showToast("相册已创建并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const saveAlbum = async (a: AdminAlbum) => {
    if (!albumDraft.title.trim()) {
      showToast("请填写相册标题", "warning");
      return;
    }
    try {
      const res = await fetch("/api/photos/albums", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          id: a.id,
          title: albumDraft.title.trim(),
          date: albumDraft.date,
          description: albumDraft.description,
          cover: albumDraft.cover.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPushResult(data.push);
      setEditingAlbumId(null);
      showToast("已保存并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const startEditAlbum = (a: AdminAlbum) => {
    setEditingAlbumId(a.id);
    setAlbumDraft({ title: a.title, date: a.date, description: a.description, cover: a.cover });
  };

  const moveAlbum = async (id: string, dir: -1 | 1) => {
    try {
      const res = await fetch("/api/photos/albums", {
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

  const reorderAlbums = async (ids: string[]) => {
    try {
      const res = await fetch("/api/photos/albums", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reorder: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "排序失败");
      setPushResult(data.push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const deleteAlbum = async (a: AdminAlbum, withFiles: boolean) => {
    const msg = withFiles
      ? `确定删除相册「${a.title}」并删除其中 ${a.photos.length} 张本地图片吗？（git 历史可恢复）`
      : `确定删除相册「${a.title}」吗？（照片文件保留在 public/uploads/photos）`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`/api/photos/albums?id=${encodeURIComponent(a.id)}${withFiles ? "&deleteFiles=1" : ""}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (selectedAlbumId === a.id) setSelectedAlbumId(null);
      showToast("已删除并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const movePhoto = async (albumId: string, photoId: string, dir: -1 | 1) => {
    try {
      const res = await fetch("/api/photos/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ albumId, photoId, move: dir }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "排序失败");
      setPushResult(data.push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const reorderPhotos = async (albumId: string, photoIds: string[]) => {
    try {
      const res = await fetch("/api/photos/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ albumId, reorder: photoIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "排序失败");
      setPushResult(data.push);
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const savePhoto = async (albumId: string, p: AdminPhoto) => {
    try {
      const res = await fetch("/api/photos/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          albumId,
          photoId: p.id,
          caption: photoDraft.caption,
          takenAt: photoDraft.takenAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setPushResult(data.push);
      setEditingPhotoId(null);
      showToast("已保存并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const deletePhoto = async (albumId: string, p: AdminPhoto, withFile: boolean) => {
    const msg = withFile ? `确定删除这张照片并移除本地文件吗？（git 历史可恢复）` : `确定从相册移除这张照片吗？`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(
        `/api/photos/items?albumId=${encodeURIComponent(albumId)}&photoId=${encodeURIComponent(p.id)}${withFile ? "&deleteFile=1" : ""}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setPushResult(data.push);
      if (editingPhotoId === p.id) setEditingPhotoId(null);
      showToast("已删除并推送", "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    }
  };

  const uploadAndAdd = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length || !selectedAlbum) return;
    setUploading(true);
    try {
      const form = new FormData();
      list.forEach((f) => form.append("files", f));
      const res = await fetch("/api/photos/upload", { method: "POST", headers: authHeaders(), body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      const okFiles = data.files || [];
      let added = 0;
      let lastPush: AutopushResult | undefined;
      if (okFiles.length) {
        const r2 = await fetch("/api/photos/items", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ albumId: selectedAlbum.id, urls: okFiles.map((f: { url: string }) => f.url) }),
        });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error || "添加照片失败");
        added = okFiles.length;
        lastPush = d2.push;
      }
      setPushResult(lastPush ?? null);
      const failCount = list.length - added + (data.errors?.length || 0);
      showToast(`上传完成：新增 ${added} 张${failCount ? `，失败 ${failCount} 张` : ""}`, failCount ? "warning" : "success");
      refresh();
    } catch (err) {
      showToast(String((err as Error).message || err), "error");
    } finally {
      setUploading(false);
    }
  };

  /** 拖拽落点：把 dragId 移到 targetId 之前，返回新 id 顺序 */
  const applyDrop = (list: Array<{ id: string }>, drag: string, target: string): string[] => {
    const ids = list.map((x) => x.id);
    const from = ids.indexOf(drag);
    const to = ids.indexOf(target);
    if (from < 0 || to < 0 || from === to) return ids;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, drag);
    return next;
  };

  const dropAlbum = (targetId: string) => {
    if (!dragId) return;
    reorderAlbums(applyDrop(albums, dragId, targetId));
    setDragId(null);
  };

  const dropPhoto = (targetId: string) => {
    if (!dragId || !selectedAlbum) return;
    reorderPhotos(selectedAlbum.id, applyDrop(selectedAlbum.photos, dragId, targetId));
    setDragId(null);
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
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {selectedAlbum ? selectedAlbum.title : "照片墙管理"}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {selectedAlbum
              ? `${selectedAlbum.photos.length} 张照片 · ${selectedAlbum.date}`
              : `共 ${albums.length} 个相册 · ${albums.reduce((n, a) => n + a.photos.length, 0)} 张照片`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedAlbum ? (
            <button
              onClick={() => setSelectedAlbumId(null)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-sm font-black border border-white/40 dark:border-white/10 hover:bg-white/70 transition-all"
            >
              <ArrowLeft size={15} /> 返回相册列表
            </button>
          ) : (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-all"
            >
              {showCreate ? <X size={15} /> : <Plus size={15} />}
              {showCreate ? "取消" : "新建相册"}
            </button>
          )}
        </div>
      </div>

      <AutopushBanner result={pushResult} />

      {selectedAlbum ? (
        <>
          {/* 上传区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              uploadAndAdd(e.dataTransfer.files);
            }}
            className={`rounded-3xl border-2 border-dashed p-6 md:p-8 text-center mb-6 transition-all ${
              dragging ? "border-indigo-500 bg-indigo-500/10" : "border-white/40 dark:border-white/15 bg-white/30 dark:bg-slate-800/30"
            }`}
          >
            <Upload size={22} className="mx-auto text-indigo-500 mb-2" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
              {uploading ? "上传中..." : `拖拽图片到这里，或点击选择（支持多张）`}
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              multiple
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files) uploadAndAdd(e.target.files);
                e.target.value = "";
              }}
              className="text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-indigo-500 file:text-white file:text-xs file:font-black file:cursor-pointer hover:file:bg-indigo-600"
            />
          </div>

          {/* 照片网格 */}
          {selectedAlbum.photos.length === 0 && (
            <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
              相册还是空的，拖几张照片进来吧。排序支持拖拽换位或 ↑↓ 按钮。
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {selectedAlbum.photos.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropPhoto(p.id)}
                className={`group rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-800/50 border border-white/50 dark:border-white/10 shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                  dragId === p.id ? "opacity-50 scale-95" : ""
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={p.url} alt={p.caption || "照片"} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => movePhoto(selectedAlbum.id, p.id, -1)} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-indigo-500 transition-colors" title="上移">
                      <ArrowUp size={13} />
                    </button>
                    <button onClick={() => movePhoto(selectedAlbum.id, p.id, 1)} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-indigo-500 transition-colors" title="下移">
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>
                <div className="p-2.5">
                  {editingPhotoId === p.id ? (
                    <div className="space-y-2">
                      <input className={`${inputCls} !text-xs`} placeholder="描述" value={photoDraft.caption} onChange={(e) => setPhotoDraft({ ...photoDraft, caption: e.target.value })} />
                      <input className={`${inputCls} !text-xs`} type="date" value={photoDraft.takenAt} onChange={(e) => setPhotoDraft({ ...photoDraft, takenAt: e.target.value })} />
                      <div className="flex gap-1.5">
                        <button onClick={() => savePhoto(selectedAlbum.id, p)} className="px-2 py-1 rounded-lg bg-indigo-500 text-white text-[11px] font-black">保存</button>
                        <button onClick={() => setEditingPhotoId(null)} className="px-2 py-1 rounded-lg bg-white/50 text-slate-500 text-[11px] font-black">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{p.caption || "未命名"}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.takenAt || "—"}</p>
                      <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingPhotoId(p.id);
                            setPhotoDraft({ caption: p.caption || "", takenAt: p.takenAt || "" });
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-500 transition-colors"
                          title="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deletePhoto(selectedAlbum.id, p, false)} className="p-1 rounded-md text-slate-400 hover:text-red-500 transition-colors" title="移出相册">
                          <Trash2 size={13} />
                        </button>
                        <button onClick={() => deletePhoto(selectedAlbum.id, p, true)} className="p-1 rounded-md text-slate-400 hover:text-red-600 transition-colors" title="删除并移除本地文件">
                          <Trash2 size={13} className="opacity-70" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* 新建相册 */}
          {showCreate && (
            <div className="rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg p-5 mb-6">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>相册标题 *</label>
                  <input className={inputCls} value={newAlbum.title} onChange={(e) => setNewAlbum({ ...newAlbum, title: e.target.value })} placeholder="如：雨天漫游" />
                </div>
                <div>
                  <label className={labelCls}>日期</label>
                  <input className={inputCls} type="date" value={newAlbum.date} onChange={(e) => setNewAlbum({ ...newAlbum, date: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>描述</label>
                  <input className={inputCls} value={newAlbum.description} onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })} placeholder="一句话介绍" />
                </div>
              </div>
              <button onClick={createAlbum} className="mt-3 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-black hover:bg-indigo-600 transition-all">
                创建相册
              </button>
            </div>
          )}

          {albums.length === 0 && !showCreate && (
            <div className="rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/10 p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
              还没有相册，点击右上角「新建相册」开始吧。
            </div>
          )}

          {/* 相册列表 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {albums.map((a) => (
              <div
                key={a.id}
                draggable
                onDragStart={() => setDragId(a.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropAlbum(a.id)}
                className={`rounded-3xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-white/50 dark:border-white/10 shadow-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01] ${dragId === a.id ? "opacity-50" : ""}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden" onClick={() => setSelectedAlbumId(a.id)}>
                  {a.cover ? (
                    <img src={a.cover} alt={a.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <Images size={32} className="text-indigo-500/50" />
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-black backdrop-blur-sm">
                    {a.photos.length} 张
                  </span>
                </div>
                <div className="p-4">
                  {editingAlbumId === a.id ? (
                    <div className="space-y-2">
                      <input className={`${inputCls} !text-xs`} value={albumDraft.title} onChange={(e) => setAlbumDraft({ ...albumDraft, title: e.target.value })} />
                      <input className={`${inputCls} !text-xs`} type="date" value={albumDraft.date} onChange={(e) => setAlbumDraft({ ...albumDraft, date: e.target.value })} />
                      <input className={`${inputCls} !text-xs`} placeholder="描述" value={albumDraft.description} onChange={(e) => setAlbumDraft({ ...albumDraft, description: e.target.value })} />
                      <input className={`${inputCls} !text-xs`} placeholder="封面 URL（留空自动取第一张）" value={albumDraft.cover} onChange={(e) => setAlbumDraft({ ...albumDraft, cover: e.target.value })} />
                      <div className="flex gap-1.5">
                        <button onClick={() => saveAlbum(a)} className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white text-[11px] font-black">保存</button>
                        <button onClick={() => setEditingAlbumId(null)} className="px-2.5 py-1 rounded-lg bg-white/50 text-slate-500 text-[11px] font-black">取消</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-black text-slate-900 dark:text-white truncate">{a.title}</h3>
                        <span className="text-[10px] font-black text-slate-400 shrink-0">{a.date}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{a.description || "暂无描述"}</p>
                      <div className="flex items-center gap-1 mt-3">
                        <button onClick={() => moveAlbum(a.id, -1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="上移">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => moveAlbum(a.id, 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="下移">
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAlbumId(a.id);
                          }}
                          className="ml-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 text-[11px] font-black hover:bg-indigo-500 hover:text-white transition-all"
                        >
                          管理照片
                        </button>
                        <div className="flex-1" />
                        <button onClick={() => startEditAlbum(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/40 transition-all" title="编辑">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteAlbum(a, false)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/40 transition-all" title="删除相册">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={() => deleteAlbum(a, true)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white/40 transition-all" title="删除相册并移除本地图片">
                          <Trash2 size={14} className="opacity-70" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
