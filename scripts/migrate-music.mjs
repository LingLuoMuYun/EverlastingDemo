// scripts/migrate-music.mjs —— 从网易云拉取歌曲元数据+歌词，生成/合并 data/music/library.json
// 用法：node scripts/migrate-music.mjs --ids=1441758494,1350160463
// 从网易云拉取歌曲元数据+歌词，合并到 data/music/library.json（按 id 更新或新增）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libraryPath = path.join(root, "data", "music", "library.json");
const siteConfigPath = path.join(root, "siteConfig.ts");

const NET_EASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

function extractCloudMusicIds() {
  if (!fs.existsSync(siteConfigPath)) return [];
  const src = fs.readFileSync(siteConfigPath, "utf8");
  const match = src.match(/cloudMusicIds\s*:\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/"(\d+)"/g)].map((m) => m[1]);
}

function readLibrary() {
  if (!fs.existsSync(libraryPath)) return { version: 1, tracks: [] };
  return JSON.parse(fs.readFileSync(libraryPath, "utf8"));
}

async function fetchSong(id) {
  const [detailRes, lrcRes] = await Promise.all([
    fetch(`https://music.163.com/api/song/detail/?id=${id}&ids=[${id}]`, {
      headers: NET_EASE_HEADERS,
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`https://music.163.com/api/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`, {
      headers: NET_EASE_HEADERS,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null),
  ]);
  const detail = await detailRes.json();
  const song = detail.songs?.[0];
  if (!song) throw new Error(`歌曲不存在或接口异常: ${id}`);

  let lrc = "";
  let tlyric = "";
  let yrc = null;
  if (lrcRes && lrcRes.ok) {
    const data = await lrcRes.json();
    lrc = data.lrc?.lyric || "";
    tlyric = data.tlyric?.lyric || "";
    yrc = data.yrc?.lyric || null;
  }

  return {
    id: `netease-${id}`,
    source: "netease",
    neteaseId: id,
    title: song.name,
    artist: song.artists?.[0]?.name || "未知歌手",
    album: song.album?.name || "",
    cover: song.album?.picUrl || "",
    lyrics: { lrc, tlyric, yrc },
  };
}

async function main() {
  const argIds = process.argv.find((a) => a.startsWith("--ids="))?.split("=")[1] || "";
  const ids = argIds ? argIds.split(",").map((s) => s.trim()).filter(Boolean) : extractCloudMusicIds();
  if (!ids.length) {
    console.error("未找到要迁移的网易云 ID，请用 --ids=1441758494,1350160463 传入");
    process.exit(1);
  }

  const library = readLibrary();
  let fail = 0;
  for (const id of ids) {
    try {
      const track = await fetchSong(id);
      const idx = library.tracks.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        library.tracks[idx] = { ...library.tracks[idx], ...track };
        console.log(`✓ 更新 ${id} ${track.title}`);
      } else {
        const maxOrder = library.tracks.reduce((m, t) => Math.max(m, t.order), 0);
        library.tracks.push({ ...track, order: maxOrder + 1, addedAt: new Date().toISOString() });
        console.log(`✓ 新增 ${id} ${track.title}`);
      }
    } catch (err) {
      fail++;
      console.error(`✗ ${id}: ${err.message}`);
    }
  }

  fs.mkdirSync(path.dirname(libraryPath), { recursive: true });
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2) + "\n", "utf8");
  console.log(fail ? `完成，${fail} 个失败（其余已写入）` : "完成，全部成功");
  process.exit(fail ? 1 : 0);
}

main();
