// scripts/migrate-notes.mjs —— 将 posts/ chatters/ moments/ 迁移为 notes/ 统一目录
// 用法：
//   node scripts/migrate-notes.mjs --dry-run   # 只输出迁移报告，不写文件
//   node scripts/migrate-notes.mjs             # 正式迁移（跳过内容一致的已存在目标）
//   node scripts/migrate-notes.mjs --force     # 覆盖已存在目标（谨慎）
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, "notes");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const SOURCES = [
  { dir: "posts", kind: "article" },
  { dir: "chatters", kind: "talk" },
  { dir: "moments", kind: "moment" },
  { dir: path.join("posts", "moments"), kind: "moment" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toLocalString(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  return value;
}

function firstTextLine(content) {
  return (
    content
      .replace(/^#+ .*\n/m, "")
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) || ""
  );
}

const report = [];
const conflicts = [];

for (const { dir, kind } of SOURCES) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.existsSync(dirPath)) continue;

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const sourcePath = path.join(dirPath, file);
    const stat = fs.statSync(sourcePath);
    const { data, content } = matter(fs.readFileSync(sourcePath, "utf8"));
    const baseSlug = file.replace(/\.md$/, "");

    // 补默认字段（统一 frontmatter 规范，见企划书 §3.1/§3.6）
    data.kind = data.kind || kind;
    if (!data.title) data.title = baseSlug;
    if (!data.date) data.date = stat.mtime.toISOString().slice(0, 10);
    data.date = toLocalString(data.date);
    if (!data.description) data.description = firstTextLine(content).slice(0, 100);
    if (!Array.isArray(data.tags)) data.tags = [];
    if (!data.images && !Array.isArray(data.images)) data.images = [];

    let targetSlug = baseSlug;
    let counter = 2;
    while (fs.existsSync(path.join(NOTES_DIR, `${targetSlug}.md`)) && !force) {
      const existing = matter(fs.readFileSync(path.join(NOTES_DIR, `${targetSlug}.md`), "utf8"));
      if (existing.data.kind === data.kind && existing.content.trim() === content.trim()) {
        report.push({ sourcePath, target: targetSlug, status: "skip-identical" });
        targetSlug = null;
        break;
      }
      targetSlug = `${baseSlug}-${counter++}`;
    }
    if (targetSlug === null) continue;

    if (targetSlug !== baseSlug) {
      conflicts.push({ from: `/${dir.replace(/\\/g, "/")}/${baseSlug}`, to: `/notes/${targetSlug}` });
    }

    if (!dryRun) {
      fs.mkdirSync(NOTES_DIR, { recursive: true });
      fs.writeFileSync(path.join(NOTES_DIR, `${targetSlug}.md`), matter.stringify(content.trim() + "\n", data), "utf8");
    }
    report.push({ sourcePath, target: targetSlug, status: dryRun ? "would-migrate" : "migrated" });
  }
}

console.log(dryRun ? "── DRY RUN（未写任何文件）──" : "── 迁移完成 ──");
for (const r of report) {
  console.log(`[${r.status}] ${r.sourcePath} → notes/${r.target}.md`);
}

if (conflicts.length) {
  console.log("\n⚠ 冲突改名（需在 next.config.ts redirects 或 data/redirects.ts 中补充映射）：");
  for (const c of conflicts) console.log(`  ${c.from} → ${c.to}`);
} else {
  console.log("\n✓ 无 slug 冲突；旧路由已由 next.config.ts 统一 301 到 /notes/:slug");
}

console.log("\n提示：旧目录保留（只读归档），确认无误后可用 --force 重跑或手动删除。");
