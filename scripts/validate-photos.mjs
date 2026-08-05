// scripts/validate-photos.mjs —— 校验 data/photos/library.json 结构与本地图片存在性
// 用法：node scripts/validate-photos.mjs
import fs from "node:fs";
import path from "node:path";

const libraryPath = path.join(process.cwd(), "data", "photos", "library.json");
const publicDir = path.join(process.cwd(), "public");
const ID_RE = /^[a-z0-9-]+$/;

if (!fs.existsSync(libraryPath)) {
  console.log("data/photos/library.json 不存在，跳过校验。");
  process.exit(0);
}

const library = JSON.parse(fs.readFileSync(libraryPath, "utf8"));
const errors = [];

if (library.version !== 1) errors.push(`version 应为 1，当前 ${library.version}`);
if (!Array.isArray(library.albums)) errors.push("albums 应为数组");

const albumIds = new Set();
for (const a of library.albums || []) {
  if (!ID_RE.test(a.id)) errors.push(`${a.id}: 相册 id 非法`);
  if (albumIds.has(a.id)) errors.push(`${a.id}: 相册 id 重复`);
  albumIds.add(a.id);
  if (!a.title) errors.push(`${a.id}: 缺少 title`);
  if (!a.date || isNaN(new Date(a.date).getTime())) errors.push(`${a.id}: date 缺失或不可解析`);
  if (!Number.isInteger(a.order)) errors.push(`${a.id}: order 应为整数`);

  const photoIds = new Set();
  for (const p of Array.isArray(a.photos) ? a.photos : []) {
    if (!ID_RE.test(p.id)) errors.push(`${a.id}/${p.id}: 照片 id 非法`);
    if (photoIds.has(p.id)) errors.push(`${a.id}/${p.id}: 照片 id 重复`);
    photoIds.add(p.id);
    if (!p.url) {
      errors.push(`${a.id}/${p.id}: 缺少 url`);
    } else if (p.url.startsWith("/uploads/photos/")) {
      const filePath = path.join(publicDir, p.url.replace(/^\//, ""));
      if (!fs.existsSync(filePath)) errors.push(`${a.id}/${p.id}: 本地图片不存在 ${p.url}`);
    }
    if (!Number.isInteger(p.order)) errors.push(`${a.id}/${p.id}: order 应为整数`);
  }
}

if (errors.length) {
  console.error(`✗ 发现 ${errors.length} 个问题：`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✓ 校验通过：${library.albums?.length || 0} 个相册（${(library.albums || []).reduce((n, a) => n + (a.photos?.length || 0), 0)} 张照片）`);
