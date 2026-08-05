// scripts/validate-notes.mjs —— 校验 notes/ 下全部 Markdown 的 frontmatter
// 用法：node scripts/validate-notes.mjs [--strict]
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const NOTES_DIR = path.join(process.cwd(), "notes");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = ["article", "talk"];
const strict = process.argv.includes("--strict");

if (!fs.existsSync(NOTES_DIR)) {
  console.log("notes/ 目录不存在，跳过校验。");
  process.exit(0);
}

const files = fs.readdirSync(NOTES_DIR).filter((f) => f.endsWith(".md"));
const errors = [];

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  if (!SLUG_RE.test(slug)) errors.push(`${file}: slug 非法（仅允许小写字母/数字/中划线）`);
  const { data } = matter(fs.readFileSync(path.join(NOTES_DIR, file), "utf8"));
  if (!KINDS.includes(data.kind)) errors.push(`${file}: kind 缺失或非法（${KINDS.join("/")}）`);
  if (!data.date || isNaN(new Date(data.date).getTime())) errors.push(`${file}: date 缺失或不可解析`);
  if (!strict && data.kind === "article" && !data.title) errors.push(`${file}: 文章需要 title（杂谈可省略）`);
}

if (errors.length) {
  console.error(`✗ 发现 ${errors.length} 个问题：`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✓ 校验通过：${files.length} 个笔记文件（${strict ? "strict" : "默认"}模式）`);
