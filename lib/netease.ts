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
    lyrics: { lrc, tlyric, yrc },
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
