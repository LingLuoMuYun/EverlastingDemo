// lib/music-import.ts —— 网易云歌单导入编排（仅服务端使用）
import { getLibrary, addTrack, updateTrack, type MusicTrack } from "./music";
import { fetchNeteasePlaylist, fetchNeteaseTrack } from "./netease";

export interface PlaylistImportOptions {
  playlistId: string;
  skipExisting?: boolean; // 默认 true：已存在则跳过；false：用最新元数据覆盖更新
  maxSongs?: number; // 默认 50，上限 200
  tags?: string[];
  collectionId?: string;
}

export interface PlaylistItemResult {
  id: string;
  name: string;
  reason: string;
}

export interface PlaylistImportReport {
  playlist: { id: string; name: string; cover: string; trackCount: number };
  imported: MusicTrack[];
  skipped: PlaylistItemResult[];
  failed: PlaylistItemResult[];
}

export interface PlaylistPreview {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  fetched: number;
  existingCount: number;
  tracks: Array<{
    id: string;
    name: string;
    artist: string;
    album: string;
    duration?: number;
    exists: boolean;
  }>;
}

/** 歌单预览：拉取歌单详情 + 标记库内已有歌曲（不写库） */
export async function previewPlaylist(playlistId: string, limit = 100): Promise<PlaylistPreview> {
  const playlist = await fetchNeteasePlaylist(playlistId, limit);
  const library = getLibrary();
  const existing = new Set(
    library.tracks.filter((t) => t.source === "netease" && t.neteaseId).map((t) => t.neteaseId as string)
  );
  return {
    id: playlist.id,
    name: playlist.name,
    cover: playlist.cover,
    trackCount: playlist.trackCount,
    fetched: playlist.tracks.length,
    existingCount: playlist.tracks.filter((t) => existing.has(t.id)).length,
    tracks: playlist.tracks.map((t) => ({ ...t, exists: existing.has(t.id) })),
  };
}

/** 批量导入歌单：逐首抓歌词 + 去重入库，返回导入报告 */
export async function importPlaylist(opts: PlaylistImportOptions): Promise<PlaylistImportReport> {
  const maxSongs = Math.min(Math.max(1, Math.floor(opts.maxSongs || 50)), 200);
  const playlist = await fetchNeteasePlaylist(opts.playlistId, maxSongs);
  const library = getLibrary();
  const existing = new Set(
    library.tracks.filter((t) => t.source === "netease" && t.neteaseId).map((t) => t.neteaseId as string)
  );
  const skipExisting = opts.skipExisting !== false;
  const report: PlaylistImportReport = {
    playlist: { id: playlist.id, name: playlist.name, cover: playlist.cover, trackCount: playlist.trackCount },
    imported: [],
    skipped: [],
    failed: [],
  };

  const CHUNK = 4; // 并发防风控
  for (let i = 0; i < playlist.tracks.length; i += CHUNK) {
    const chunk = playlist.tracks.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (t) => {
        const name = t.name;
        try {
          if (existing.has(t.id)) {
            if (skipExisting) {
              return { kind: "skipped" as const, item: { id: t.id, name, reason: "曲库已存在" } };
            }
            const meta = await fetchNeteaseTrack(t.id);
            const updated = updateTrack(`netease-${t.id}`, {
              title: meta.title,
              artist: meta.artist,
              album: meta.album || undefined,
              cover: meta.cover || undefined,
              duration: meta.duration ?? t.duration,
              lyrics: meta.lyrics,
            });
            return { kind: "imported" as const, track: updated, updated: true };
          }
          const meta = await fetchNeteaseTrack(t.id);
          const track = addTrack({
            ...meta,
            duration: meta.duration ?? t.duration,
            tags: opts.tags?.length ? opts.tags : undefined,
            collectionIds: opts.collectionId ? [opts.collectionId] : undefined,
          });
          existing.add(t.id);
          return { kind: "imported" as const, track, updated: false };
        } catch (err) {
          return {
            kind: "failed" as const,
            item: { id: t.id, name, reason: String((err as Error).message || err).slice(0, 120) },
          };
        }
      })
    );
    for (const r of results) {
      if (r.kind === "imported") report.imported.push(r.track);
      else if (r.kind === "skipped") report.skipped.push(r.item);
      else report.failed.push(r.item);
    }
  }
  return report;
}
