// scripts/cleanup-uploads.mjs — 清理未被引用的上传文件
// 覆盖范围：笔记图片（public/uploads/notes）、照片墙图片（public/uploads/photos）、本地音频（public/music）
// 引用来源：notes/*.md、data/photos/library.json、data/music/library.json、
//          data/site/config.json、data/friends/library.json、data/projects/library.json
// 用法：
//   node scripts/cleanup-uploads.mjs           # 仅扫描并列出（dry-run，默认）
//   node scripts/cleanup-uploads.mjs --apply   # 实际删除未引用文件
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function relativeToPublic(filePath) {
  return path.relative(path.join(ROOT, "public"), filePath).replace(/\\/g, "/");
}

function addJsonRefs(refs, file, keys) {
  if (!fs.existsSync(file)) return;
  const lib = JSON.parse(fs.readFileSync(file, "utf8"));
  const walk = (value) => {
    if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
      refs.add(value.replace(/^\/+/, "").replace(/\\/g, "/"));
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(keys ? keys.map((k) => lib[k]).filter(Boolean) : lib);
}

function collectReferences() {
  const refs = new Set();

  // 1) 笔记：正文与 frontmatter 里的 /uploads/notes/xxx
  const notesDir = path.join(ROOT, "notes");
  if (fs.existsSync(notesDir)) {
    for (const f of fs.readdirSync(notesDir).filter((x) => x.endsWith(".md"))) {
      const text = fs.readFileSync(path.join(notesDir, f), "utf8");
      for (const m of text.matchAll(/\/uploads\/notes\/[A-Za-z0-9._-]+/g)) {
        refs.add(m[0].replace(/^\/+/, ""));
      }
    }
  }

  // 2) 照片墙 / 音乐 / 站点配置 / 友链 / 项目：JSON 中以 / 开头的本地路径
  addJsonRefs(refs, path.join(ROOT, "data/photos/library.json"));
  addJsonRefs(refs, path.join(ROOT, "data/music/library.json"));
  addJsonRefs(refs, path.join(ROOT, "data/site/config.json"));
  addJsonRefs(refs, path.join(ROOT, "data/friends/library.json"));
  addJsonRefs(refs, path.join(ROOT, "data/projects/library.json"));

  return refs;
}

const refs = collectReferences();
const scopes = [
  { label: "笔记图片", dir: path.join(ROOT, "public/uploads/notes") },
  { label: "照片墙图片", dir: path.join(ROOT, "public/uploads/photos") },
  { label: "本地音频", dir: path.join(ROOT, "public/music") },
];

let total = 0;
for (const scope of scopes) {
  const files = listFiles(scope.dir);
  const orphans = files.filter((f) => !refs.has(relativeToPublic(f)));
  if (!orphans.length) {
    console.log(`✓ ${scope.label}：无未引用文件`);
    continue;
  }
  console.log(`\n${scope.label}（${orphans.length} 个未引用文件${APPLY ? "，已删除" : "，dry-run 不删除"}）：`);
  for (const f of orphans) {
    total++;
    console.log(`  - ${relativeToPublic(f)}`);
    if (APPLY) fs.rmSync(f, { force: true });
  }
}

if (total === 0) {
  console.log("\n没有需要清理的文件。");
} else if (APPLY) {
  console.log(`\n已删除 ${total} 个文件。确认效果后请 git add -A && git commit 提交（历史可在 git 中恢复）。`);
} else {
  console.log(`\n共 ${total} 个未引用文件。确认无误后执行：node scripts/cleanup-uploads.mjs --apply`);
}
