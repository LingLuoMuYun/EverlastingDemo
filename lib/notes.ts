import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { NoteKind, NoteMeta } from "./types";
import { normalizeDate } from "./dates";
import { getCached, clearCache } from "./cache";

export const NOTES_DIR = path.join(process.cwd(), "notes");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS: NoteKind[] = ["article", "talk", "moment"];
const CACHE_KEY = "notes:all";

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** 校验单个笔记 frontmatter，返回错误数组（空数组=合法） */
export function validateNoteMeta(slug: string, data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!isValidSlug(slug)) errors.push(`slug 非法: ${slug}`);
  if (!KINDS.includes(data.kind as NoteKind)) errors.push(`${slug}: kind 缺失或非法`);
  if (!data.date || isNaN(new Date(data.date as string).getTime())) {
    errors.push(`${slug}: date 缺失或不可解析`);
  }
  return errors;
}

function readNoteFile(fileName: string): NoteMeta | null {
  const slug = fileName.replace(/\.md$/, "");
  if (!isValidSlug(slug)) {
    console.warn(`[notes] 跳过非法文件名: ${fileName}`);
    return null;
  }
  const { data, content } = matter(fs.readFileSync(path.join(NOTES_DIR, fileName), "utf8"));
  const errors = validateNoteMeta(slug, data);
  if (errors.length) {
    console.warn(`[notes] ${errors.join("; ")}`);
    return null;
  }
  const rawDate = normalizeDate(data.date) || String(data.date);
  return {
    slug,
    ...(data as Omit<NoteMeta, "slug" | "content">),
    date: rawDate,
    content,
    excerpt: data.description || content.replace(/^#+ .*\n/m, "").substring(0, 100),
  };
}

/** 读取全部笔记（默认过滤 draft；includeDraft 供编辑器使用） */
export function getAllNotes(options?: { includeDraft?: boolean }): NoteMeta[] {
  const fetcher = () => {
    if (!fs.existsSync(NOTES_DIR)) return [];
    return fs
      .readdirSync(NOTES_DIR)
      .filter((f) => f.endsWith(".md"))
      .map(readNoteFile)
      .filter((n): n is NoteMeta => n !== null)
      .filter((n) => options?.includeDraft || !n.draft)
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return diff !== 0 ? diff : b.slug.localeCompare(a.slug);
      });
  };
  // 编辑器写入后 clearCache 失效；前台读取走 60s TTL 缓存
  return options?.includeDraft ? fetcher() : getCached(CACHE_KEY, fetcher);
}

/** 列表/搜索/归档用：只保留元数据，去掉正文以控制内存 */
export function getAllNotesMeta(options?: { includeDraft?: boolean }) {
  return getAllNotes(options).map(({ content: _content, ...meta }) => meta);
}

export function getNote(slug: string, options?: { includeDraft?: boolean }): NoteMeta | null {
  if (!isValidSlug(slug)) return null;
  return getAllNotes({ includeDraft: options?.includeDraft ?? true }).find((n) => n.slug === slug) || null;
}

/** 编辑器冲突检测用：返回文件 mtime（毫秒），不存在返回 null */
export function getNoteMtime(slug: string): number | null {
  if (!isValidSlug(slug)) return null;
  const filePath = path.join(NOTES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).mtimeMs;
}

/** 编辑器/API 保存：写回 notes/{slug}.md 并失效缓存 */
export function saveNote(input: { slug: string; data: Record<string, unknown>; content: string }) {
  if (!isValidSlug(input.slug)) throw new Error("slug 非法");
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  const filePath = path.join(NOTES_DIR, `${input.slug}.md`);
  const body = input.content.replace(/\r\n/g, "\n").trim() + "\n";
  fs.writeFileSync(filePath, matter.stringify(body, input.data), "utf8");
  clearCache(CACHE_KEY);
  return filePath;
}

export function deleteNote(slug: string) {
  if (!isValidSlug(slug)) throw new Error("slug 非法");
  fs.rmSync(path.join(NOTES_DIR, `${slug}.md`), { force: true });
  clearCache(CACHE_KEY);
}

/** 生成 slug：yyyy-mm-dd-<拉丁字母/数字标题>，标题无拉丁字符时回退为 note-时间戳 */
export function generateSlug(title: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePrefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const latin = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (latin) return `${datePrefix}-${latin}`;
  return `${datePrefix}-note-${Date.now().toString(36)}`;
}
