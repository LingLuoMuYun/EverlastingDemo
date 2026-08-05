// lib/music.ts —— 音乐曲库数据层（仿 lib/notes.ts）
// 唯一权威数据源：data/music/library.json；播放器 / 管理后台 / API 都从这里读
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";

export const MUSIC_DIR = path.join(process.cwd(), "data", "music");
export const MUSIC_LIBRARY_PATH = path.join(MUSIC_DIR, "library.json");

export type MusicSource = "netease" | "local";

export interface MusicTrack {
  id: string;
  source: MusicSource;
  neteaseId?: string;
  file?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  lyrics?: { lrc?: string; tlyric?: string; yrc?: string | null } | null;
  order: number;
  addedAt?: string;
}

export interface MusicLibrary {
  version: number;
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
  lyrics: MusicTrack["lyrics"];
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
  return errors;
}

function normalizeLibrary(raw: MusicLibrary): MusicLibrary {
  const tracks = (Array.isArray(raw?.tracks) ? raw.tracks : [])
    .map((t) => {
      const errors = validateTrack(t);
      if (errors.length) {
        console.warn(`[music] ${errors.join("; ")}`);
        return null;
      }
      return t;
    })
    .filter((t): t is MusicTrack => t !== null)
    .sort((a, b) => a.order - b.order);
  return { version: raw?.version ?? 1, tracks };
}

/** 读取曲库（带 60s TTL 缓存；写入后 clearCache 立即生效） */
export function getLibrary(): MusicLibrary {
  const fetcher = (): MusicLibrary => {
    if (!fs.existsSync(MUSIC_LIBRARY_PATH)) return { version: 1, tracks: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(MUSIC_LIBRARY_PATH, "utf8")) as MusicLibrary;
      return normalizeLibrary(raw);
    } catch (err) {
      console.error("[music] library.json 解析失败:", err);
      return { version: 1, tracks: [] };
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

/** 删除曲目 */
export function removeTrack(id: string) {
  const library = getLibrary();
  const tracks = library.tracks.filter((t) => t.id !== id);
  if (tracks.length === library.tracks.length) throw new Error(`曲目不存在: ${id}`);
  saveLibrary({ ...library, tracks });
  return id;
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
    lyrics: track.lyrics ?? null,
  };
}

/** 供 /api/music/library 返回（公开读取，去掉内部字段） */
export function toPublicLibrary(): { version: number; tracks: ComposedTrack[] } {
  const library = getLibrary();
  return { version: library.version, tracks: library.tracks.map(composeTrack) };
}
