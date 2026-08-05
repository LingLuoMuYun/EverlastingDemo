// scripts/validate-music.mjs —— 校验 data/music/library.json 结构与本地文件存在性
// 用法：node scripts/validate-music.mjs [--strict]
import fs from "node:fs";
import path from "node:path";

const libraryPath = path.join(process.cwd(), "data", "music", "library.json");
const publicDir = path.join(process.cwd(), "public");
const ID_RE = /^[a-z0-9-]+$/;
const strict = process.argv.includes("--strict");

if (!fs.existsSync(libraryPath)) {
  console.log("data/music/library.json 不存在，跳过校验。");
  process.exit(0);
}

const library = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
const errors = [];

if (library.version !== 2) errors.push(`version 应为 2，当前 ${library.version}`);
if (!Array.isArray(library.tracks)) errors.push("tracks 应为数组");

const ids = new Set();
const collectionIds = new Set();
for (const c of Array.isArray(library.collections) ? library.collections : []) {
  if (!ID_RE.test(c.id)) errors.push(`${c.id}: 歌单 id 非法`);
  if (collectionIds.has(c.id)) errors.push(`${c.id}: 歌单 id 重复`);
  collectionIds.add(c.id);
  if (!c.name) errors.push(`${c.id}: 歌单缺少 name`);
  if (!Number.isInteger(c.order)) errors.push(`${c.id}: 歌单 order 应为整数`);
}

for (const t of library.tracks || []) {
  if (!ID_RE.test(t.id)) errors.push(`${t.id}: id 非法（仅允许小写字母/数字/中划线）`);
  if (ids.has(t.id)) errors.push(`${t.id}: id 重复`);
  ids.add(t.id);
  if (t.source !== "netease" && t.source !== "local") errors.push(`${t.id}: source 非法（netease/local）`);
  if (t.source === "netease" && !/^\d+$/.test(String(t.neteaseId || ""))) {
    errors.push(`${t.id}: netease 曲目缺少数字 neteaseId`);
  }
  if (t.source === "local") {
    if (!t.file) errors.push(`${t.id}: local 曲目缺少 file`);
    else if (!fs.existsSync(path.join(publicDir, t.file))) errors.push(`${t.id}: 本地文件不存在 public/${t.file}`);
  }
  if (!t.title) errors.push(`${t.id}: 缺少 title`);
  if (!Number.isInteger(t.order)) errors.push(`${t.id}: order 应为整数`);
  if (!strict && !t.artist) errors.push(`${t.id}: 建议提供 artist`);
  if (t.tags && !Array.isArray(t.tags)) errors.push(`${t.id}: tags 应为数组`);
  if (t.duration !== undefined && (!Number.isFinite(t.duration) || t.duration <= 0)) {
    errors.push(`${t.id}: duration 应为正数（秒）`);
  }
  if (Array.isArray(t.collectionIds)) {
    for (const cid of t.collectionIds) {
      if (!collectionIds.has(cid)) errors.push(`${t.id}: 引用不存在的歌单 ${cid}`);
    }
  }
}

if (errors.length) {
  console.error(`✗ 发现 ${errors.length} 个问题：`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✓ 校验通过：${library.collections?.length || 0} 个歌单 / ${library.tracks?.length || 0} 首歌曲（${strict ? "strict" : "默认"}模式）`);
