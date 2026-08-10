// lib/music.ts —— 音乐曲库数据层（仿 lib/notes.ts）
// 唯一权威数据源：data/music/library.json；播放器 / 管理后台 / API 都从这里读
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";

export const MUSIC_DIR = path.join(process.cwd(), "data", "music");
export const MUSIC_LIBRARY_PATH = path.join(MUSIC_DIR, "library.json");

export type MusicSource = "netease" | "local";

export interface MusicCollection {
  id: string;
  name: string;
  cover?: string;
  order: number;
  /** 歌单内歌曲的有序 id 列表（缺省时由 collectionIds 派生，归一化后始终存在） */
  trackIds?: string[];
}

export interface MusicTrack {
  id: string;
  source: MusicSource;
  neteaseId?: string;
  file?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number; // 秒
  tags?: string[];
  collectionIds?: string[];
  lyrics?: { lrc?: string; tlyric?: string; yrc?: string | null } | null;
  order: number;
  addedAt?: string;
}

export interface MusicLibrary {
  version: number;
  collections: MusicCollection[];
  tracks: MusicTrack[];
}

export interface ComposedTrack {
  id: string;
  source: MusicSource;
  title: string;
  artist: string;
  album: string;
  cover: string;
  src: string;
  duration?: number;
  tags?: string[];
  collectionIds?: string[];
  lyrics: MusicTrack["lyrics"];
  addedAt?: string;
}

const CACHE_KEY = "music:library";
const ID_RE = /^[a-z0-9-]+$/;

export function isValidMusicId(id: string): boolean {
  return ID_RE.test(id);
}

/** 生成本地曲目 id：local-{yyyyMMdd}-{英文/数字 slug} */
export function generateLocalId(title: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const slug =
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "track";
  return `local-${prefix}-${slug}`;
}

/** 生成歌单 id：col-{yyyyMMdd}-{slug} */
export function generateCollectionId(name: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const slug =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || `col-${Date.now().toString(36)}`;
  return `col-${prefix}-${slug}`;
}

/** 校验单条曲目，返回错误数组（空数组 = 合法） */
export function validateTrack(track: MusicTrack): string[] {
  const errors: string[] = [];
  if (!isValidMusicId(track.id)) errors.push(`id 非法: ${track.id}`);
  if (track.source !== "netease" && track.source !== "local") {
    errors.push(`${track.id}: source 非法（netease/local）`);
  }
  if (track.source === "netease" && !/^\d+$/.test(track.neteaseId || "")) {
    errors.push(`${track.id}: netease 曲目缺少数字 neteaseId`);
  }
  if (track.source === "local" && !track.file) {
    errors.push(`${track.id}: local 曲目缺少 file`);
  }
  if (!track.title) errors.push(`${track.id}: 缺少 title`);
  if (track.tags && !Array.isArray(track.tags)) errors.push(`${track.id}: tags 应为数组`);
  if (track.collectionIds && !Array.isArray(track.collectionIds)) errors.push(`${track.id}: collectionIds 应为数组`);
  if (track.duration !== undefined && (!Number.isFinite(track.duration) || track.duration <= 0)) {
    errors.push(`${track.id}: duration 应为正数（秒）`);
  }
  return errors;
}

function normalizeLibrary(raw: MusicLibrary): MusicLibrary {
  const collections = (Array.isArray(raw?.collections) ? raw.collections : [])
    .filter((c) => c && typeof c.id === "string" && c.id && c.name)
    .sort((a, b) => a.order - b.order);
  const validCollectionIds = new Set(collections.map((c) => c.id));
  const tracks = (Array.isArray(raw?.tracks) ? raw.tracks : [])
    .map((t): MusicTrack | null => {
      const normalized: MusicTrack = {
        ...t,
        tags: Array.isArray(t.tags) ? t.tags : [],
        collectionIds: Array.isArray(t.collectionIds)
          ? Array.from(new Set(t.collectionIds.filter((id) => validCollectionIds.has(id))))
          : [],
      };
      const errors = validateTrack(normalized);
      if (errors.length) {
        console.warn(`[music] ${errors.join("; ")}`);
        return null;
      }
      return normalized;
    })
    .filter((t): t is MusicTrack => t !== null)
    .sort((a, b) => a.order - b.order);

  // 为每个歌单派生有序 trackIds：保留显式顺序，缺失的成员按曲库全局顺序补到末尾
  const membersByCollection = new Map<string, string[]>();
  for (const track of tracks) {
    for (const cid of track.collectionIds || []) {
      const list = membersByCollection.get(cid) || [];
      list.push(track.id);
      membersByCollection.set(cid, list);
    }
  }
  const normalizedCollections = collections.map((c) => {
    const members = membersByCollection.get(c.id) || [];
    const explicit = Array.isArray(c.trackIds)
      ? c.trackIds.filter((tid) => members.includes(tid))
      : [];
    const rest = members.filter((tid) => !explicit.includes(tid));
    return { ...c, trackIds: [...explicit, ...rest] };
  });
  return { version: 2, collections: normalizedCollections, tracks };
}

/** 读取曲库（带 60s TTL 缓存；写入后 clearCache 立即生效） */
export function getLibrary(): MusicLibrary {
  const fetcher = (): MusicLibrary => {
    if (!fs.existsSync(MUSIC_LIBRARY_PATH)) return { version: 2, collections: [], tracks: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(MUSIC_LIBRARY_PATH, "utf8")) as MusicLibrary;
      return normalizeLibrary(raw);
    } catch (err) {
      console.error("[music] library.json 解析失败:", err);
      return { version: 2, collections: [], tracks: [] };
    }
  };
  return getCached(CACHE_KEY, fetcher);
}

/** 写回磁盘（pretty JSON），并失效缓存 */
export function saveLibrary(library: MusicLibrary) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.writeFileSync(MUSIC_LIBRARY_PATH, JSON.stringify(normalizeLibrary(library), null, 2) + "\n", "utf8");
  clearCache(CACHE_KEY);
}

/** 新增曲目（自动分配 order / addedAt），供管理后台使用 */
export function addTrack(input: Omit<MusicTrack, "order" | "addedAt"> & { order?: number }) {
  const library = getLibrary();
  if (library.tracks.some((t) => t.id === input.id)) throw new Error(`曲目已存在: ${input.id}`);
  const maxOrder = library.tracks.reduce((m, t) => Math.max(m, t.order), 0);
  const track: MusicTrack = {
    ...input,
    order: input.order ?? maxOrder + 1,
    addedAt: new Date().toISOString(),
  };
  const errors = validateTrack(track);
  if (errors.length) throw new Error(errors.join("; "));
  saveLibrary({ ...library, tracks: [...library.tracks, track] });
  return track;
}

/** 新增歌单（自动分配 order） */
export function addCollection(name: string, cover?: string) {
  const library = getLibrary();
  const id = generateCollectionId(name);
  if (library.collections.some((c) => c.id === id)) throw new Error(`歌单已存在: ${id}`);
  const maxOrder = library.collections.reduce((m, c) => Math.max(m, c.order), 0);
  const collection: MusicCollection = { id, name, cover: cover || undefined, order: maxOrder + 1 };
  saveLibrary({ ...library, collections: [...library.collections, collection] });
  return collection;
}

/** 更新歌单（名称/封面/排序） */
export function updateCollection(id: string, patch: Partial<Omit<MusicCollection, "id">>) {
  const library = getLibrary();
  const index = library.collections.findIndex((c) => c.id === id);
  if (index < 0) throw new Error(`歌单不存在: ${id}`);
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("歌单名称不能为空");
  if (
    patch.trackIds !== undefined &&
    (!Array.isArray(patch.trackIds) || patch.trackIds.some((tid) => typeof tid !== "string" || !tid))
  ) {
    throw new Error("trackIds 应为字符串数组");
  }
  const collections = [...library.collections];
  collections[index] = { ...collections[index], ...patch, id, name: patch.name?.trim() || collections[index].name };
  saveLibrary({ ...library, collections });
  return collections[index];
}

/** 删除歌单（同时从所有曲目移除引用） */
export function removeCollection(id: string) {
  const library = getLibrary();
  if (!library.collections.some((c) => c.id === id)) throw new Error(`歌单不存在: ${id}`);
  const collections = library.collections.filter((c) => c.id !== id);
  const tracks = library.tracks.map((t) =>
    t.collectionIds?.includes(id) ? { ...t, collectionIds: t.collectionIds.filter((x) => x !== id) } : t
  );
  saveLibrary({ ...library, collections, tracks });
  return id;
}

/** 更新曲目元数据 / 排序 */
export function updateTrack(id: string, patch: Partial<Omit<MusicTrack, "id">>) {
  const library = getLibrary();
  const index = library.tracks.findIndex((t) => t.id === id);
  if (index < 0) throw new Error(`曲目不存在: ${id}`);
  const updated: MusicTrack = { ...library.tracks[index], ...patch, id };
  const errors = validateTrack(updated);
  if (errors.length) throw new Error(errors.join("; "));
  const tracks = [...library.tracks];
  tracks[index] = updated;
  saveLibrary({ ...library, tracks });
  return updated;
}

/** 批量更新曲目（只落盘一次，供批量操作使用，避免逐条触发 git 提交） */
export function updateManyTracks(ids: string[], patch: Partial<Omit<MusicTrack, "id">>) {
  const library = getLibrary();
  const idSet = new Set(ids);
  let changed = 0;
  const tracks = library.tracks.map((track) => {
    if (!idSet.has(track.id)) return track;
    const updated: MusicTrack = { ...track, ...patch, id: track.id };
    const errors = validateTrack(updated);
    if (errors.length) throw new Error(`${track.id}: ${errors.join("; ")}`);
    changed++;
    return updated;
  });
  if (changed === 0) throw new Error("没有可更新的曲目（id 不存在）");
  saveLibrary({ ...library, tracks });
  return tracks.filter((t) => idSet.has(t.id));
}

/** 交换两首曲目的排序值（一次落盘，供上移/下移使用） */
export function swapTracks(idA: string, idB: string) {
  const library = getLibrary();
  const a = library.tracks.find((t) => t.id === idA);
  const b = library.tracks.find((t) => t.id === idB);
  if (!a || !b) throw new Error(`曲目不存在：${!a ? idA : idB}`);
  const tracks = library.tracks.map((t) => {
    if (t.id === a.id) return { ...t, order: b.order };
    if (t.id === b.id) return { ...t, order: a.order };
    return t;
  });
  saveLibrary({ ...library, tracks });
  return tracks.filter((t) => t.id === idA || t.id === idB);
}

/** 删除曲目 */
export function removeTrack(id: string) {
  const library = getLibrary();
  const tracks = library.tracks.filter((t) => t.id !== id);
  if (tracks.length === library.tracks.length) throw new Error(`曲目不存在: ${id}`);
  saveLibrary({ ...library, tracks });
  return id;
}

/** 批量删除曲目（一次落盘，供批量删除使用） */
export function removeManyTracks(ids: string[]) {
  const library = getLibrary();
  const idSet = new Set(ids);
  const tracks = library.tracks.filter((t) => !idSet.has(t.id));
  if (tracks.length === library.tracks.length) throw new Error("没有可删除的曲目（id 不存在）");
  saveLibrary({ ...library, tracks });
  return library.tracks.filter((t) => idSet.has(t.id));
}

/** 把库内 Track 合成播放器可直接使用的运行时 Track */
export function composeTrack(track: MusicTrack): ComposedTrack {
  const src =
    track.source === "local" && track.file
      ? `/${track.file.replace(/^\/+/, "")}`
      : track.source === "netease" && track.neteaseId
        ? `https://music.163.com/song/media/outer/url?id=${track.neteaseId}.mp3`
        : "";
  return {
    id: track.id,
    source: track.source,
    title: track.title,
    artist: track.artist,
    album: track.album || "",
    cover: track.cover || "",
    src,
    duration: track.duration,
    tags: track.tags || [],
    collectionIds: track.collectionIds || [],
    lyrics: track.lyrics ?? null,
    addedAt: track.addedAt,
  };
}

/** 供 /api/music/library 返回（公开读取，去掉内部字段） */
export function toPublicLibrary(): { version: number; collections: MusicCollection[]; tracks: ComposedTrack[] } {
  const library = getLibrary();
  return {
    version: library.version,
    collections: library.collections,
    tracks: library.tracks.map(composeTrack),
  };
}
