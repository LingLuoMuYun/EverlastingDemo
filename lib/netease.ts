// lib/netease.ts —— 网易云接口封装（仅服务端使用）
const NET_EASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

export function composeNeteaseSrc(neteaseId: string): string {
  return `https://music.163.com/song/media/outer/url?id=${neteaseId}.mp3`;
}

export interface NeteaseTrackMeta {
  id: string; // netease-{id}
  source: "netease";
  neteaseId: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration?: number; // 秒
  lyrics: { lrc: string; tlyric: string; yrc: string | null };
}

/** 抓取网易云歌曲元数据 + 歌词（详情失败抛错；歌词失败不影响主流程） */
export async function fetchNeteaseTrack(neteaseId: string): Promise<NeteaseTrackMeta> {
  const [detailRes, lrcRes] = await Promise.all([
    fetch(`https://music.163.com/api/song/detail/?id=${neteaseId}&ids=[${neteaseId}]`, {
      headers: NET_EASE_HEADERS,
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`https://music.163.com/api/song/lyric?id=${neteaseId}&lv=-1&kv=-1&tv=-1`, {
      headers: NET_EASE_HEADERS,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null),
  ]);

  const detail = await detailRes.json();
  const song = detail.songs?.[0];
  if (!song) throw new Error(`歌曲不存在或接口异常: ${neteaseId}`);

  let lrc = "";
  let tlyric = "";
  let yrc: string | null = null;
  if (lrcRes && lrcRes.ok) {
    const data = await lrcRes.json().catch(() => null);
    if (data) {
      lrc = data.lrc?.lyric || "";
      tlyric = data.tlyric?.lyric || "";
      yrc = data.yrc?.lyric || null;
    }
  }

  return {
    id: `netease-${neteaseId}`,
    source: "netease",
    neteaseId,
    title: song.name,
    artist: song.artists?.[0]?.name || "未知歌手",
    album: song.album?.name || "",
    cover: song.album?.picUrl || "",
    duration: song.duration ? Math.round(song.duration / 1000) : undefined,
    lyrics: { lrc, tlyric, yrc },
  };
}

export interface NeteasePlaylistTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  cover: string;
  duration?: number; // 秒
}

export interface NeteasePlaylist {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  allIds: string[]; // 完整歌曲 ID 列表（v3 trackIds；旧接口无该字段时退化为已返回 tracks）
  tracks: NeteasePlaylistTrack[];
}

function toPlaylistTrack(t: Record<string, unknown>): NeteasePlaylistTrack {
  // v3 接口字段是 ar/al，旧接口是 artists/album，兼容两种
  const artists = (t.artists as Array<{ name?: string }> | undefined) ?? (t.ar as Array<{ name?: string }> | undefined);
  const albumObj = (t.album as { name?: string; picUrl?: string } | undefined) ?? (t.al as { name?: string; picUrl?: string } | undefined);
  return {
    id: String(t.id),
    name: String(t.name || "未知歌曲"),
    artist: artists?.[0]?.name || "未知歌手",
    album: albumObj?.name || "",
    cover: albumObj?.picUrl || "",
    duration: typeof t.duration === "number" ? Math.round(t.duration / 1000) : undefined,
  };
}

type RawPlaylist = {
  id?: unknown;
  name?: unknown;
  coverImgUrl?: unknown;
  trackCount?: unknown;
  trackIds?: Array<{ id?: unknown }>;
  tracks?: Array<Record<string, unknown>>;
};

/**
 * 拉取网易云歌单。
 * 实测：旧版 playlist/detail 对部分歌单会把 trackCount 与 tracks 一起截断到 10 首；
 * v3 接口未登录 tracks 只给前 10 首元数据，但 trackCount 准确且 trackIds 完整。
 * 因此优先 v3（拿准确总数 + 完整 ID），失败再回退旧接口。
 */
export async function fetchNeteasePlaylist(playlistId: string, limit = 100): Promise<NeteasePlaylist> {
  const headers = NET_EASE_HEADERS;
  const signal = AbortSignal.timeout(10000);

  // 优先 v3：trackCount 准确 + trackIds 完整
  try {
    const res = await fetch(`https://music.163.com/api/v3/playlist/detail?id=${playlistId}`, { headers, signal });
    const data = await res.json();
    const pl = data?.playlist as RawPlaylist | undefined;
    if (pl && Array.isArray(pl.trackIds)) {
      const allIds = pl.trackIds
        .map((t) => String(t?.id))
        .filter(Boolean) as string[];
      const tracks = (pl.tracks ?? []).slice(0, limit).map(toPlaylistTrack);
      return {
        id: String(pl.id),
        name: String(pl.name || "未知歌单"),
        cover: String(pl.coverImgUrl || ""),
        trackCount: Number(pl.trackCount) || allIds.length || tracks.length,
        allIds: allIds.length ? allIds : tracks.map((t) => t.id),
        tracks,
      };
    }
  } catch {
    /* 回退旧接口 */
  }

  const res = await fetch(`https://music.163.com/api/playlist/detail?id=${playlistId}`, { headers, signal });
  const data = await res.json();
  const pl = data?.result as RawPlaylist | undefined;
  if (!pl || !Array.isArray(pl.tracks)) {
    throw new Error(`歌单不存在或接口异常: ${playlistId}`);
  }
  const tracks = pl.tracks.slice(0, limit).map(toPlaylistTrack);
  const allIds = (Array.isArray(pl.trackIds) ? pl.trackIds : tracks.map((t) => ({ id: t.id })))
    .map((t) => String(t?.id))
    .filter(Boolean) as string[];
  return {
    id: String(pl.id),
    name: String(pl.name || "未知歌单"),
    cover: String(pl.coverImgUrl || ""),
    trackCount: Number(pl.trackCount) || allIds.length || tracks.length,
    allIds: allIds.length ? allIds : tracks.map((t) => t.id),
    tracks,
  };
}

export interface AudioCheckResult {
  ok: boolean;
  type: string;
  size: number;
}

/** 用 Range 0-0 跟随跳转校验音频可用性（避免下载整首） */
export async function checkAudioUrl(url: string): Promise<AudioCheckResult> {
  try {
    const res = await fetch(url, {
      headers: { ...NET_EASE_HEADERS, Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const type = res.headers.get("content-type") || "";
    return {
      ok: res.ok && type.startsWith("audio/"),
      type,
      size: Number(res.headers.get("content-length") || 0),
    };
  } catch {
    return { ok: false, type: "", size: 0 };
  }
}
