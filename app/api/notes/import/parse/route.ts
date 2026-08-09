import { NextRequest, NextResponse } from "next/server";
import matter from "gray-matter";
import { generateSlug } from "../../../../../lib/notes";
import { normalizeDate } from "../../../../../lib/dates";
import type { MarkdownImportPayload, NoteKind } from "../../../../../lib/types";

const isProd = process.env.NODE_ENV === "production";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

function nowString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 兼容 YYYY-MM-DD / YYYY-MM-DD HH:MM / YAML Date 对象，统一成 YYYY-MM-DD HH:MM */
function parseImportDate(raw: unknown): string | null {
  const normalized = normalizeDate(raw);
  if (!normalized) return null;
  const value = normalized.includes("T") ? normalized : normalized.replace(" ", "T");
  if (isNaN(new Date(value).getTime())) return null;
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasTime = normalized.includes(" ") || normalized.includes("T");
  const timePart = hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "00:00";
  return `${datePart} ${timePart}`;
}

/** 文件名 → 标题候选：去扩展名、-/_ 转空格、剥离日期前缀 */
function titleFromFileName(fileName: string): string {
  const base = fileName
    .replace(/\.(md|markdown|mdown|txt)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const cleaned = base.replace(/^\d{4} \d{2} \d{2}\s*/, "").trim();
  return cleaned || base;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim());
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(req: NextRequest) {
  if (isProd) {
    return NextResponse.json({ error: "生产环境只读：导入解析仅本地开发可用" }, { status: 403 });
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  const sourceName =
    typeof body?.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "未命名.md";

  if (!text.trim()) {
    return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  }
  if (text.length > MAX_SIZE) {
    return NextResponse.json({ error: "文件过大，请控制在 2MB 以内" }, { status: 413 });
  }

  const warnings: string[] = [];
  const { data, content } = matter(text);
  const raw = (data || {}) as Record<string, unknown>;

  let kind: NoteKind = "article";
  if (raw.kind === "article" || raw.kind === "talk") {
    kind = raw.kind;
  } else if (raw.kind !== undefined) {
    warnings.push(`kind 字段值 ${JSON.stringify(raw.kind)} 不支持，已回退为 article`);
  }

  let date = parseImportDate(raw.date);
  if (!date) {
    warnings.push("缺少有效 date，已使用当前时间");
    date = nowString();
  }

  const title =
    (typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : titleFromFileName(sourceName)) || undefined;

  const tags = parseTags(raw.tags);
  const description = typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : undefined;
  const cover = typeof raw.cover === "string" && raw.cover.trim() ? raw.cover.trim() : undefined;
  const mood = typeof raw.mood === "string" && raw.mood.trim() ? raw.mood.trim() : undefined;
  const location = typeof raw.location === "string" && raw.location.trim() ? raw.location.trim() : undefined;
  const draft = raw.draft === true || raw.draft === "true";

  if (raw.slug !== undefined) {
    warnings.push("frontmatter 中的 slug 字段将被忽略（文件名即 slug）");
  }
  const known = new Set([
    "kind", "title", "date", "description", "cover", "tags", "mood",
    "location", "draft", "updated", "excerpt",
  ]);
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length) {
    warnings.push(`已忽略未知字段：${unknown.slice(0, 8).join("、")}${unknown.length > 8 ? " 等" : ""}`);
  }

  const payload: MarkdownImportPayload = {
    source: "file",
    sourceName,
    kind,
    title,
    date,
    description,
    cover,
    tags,
    mood,
    location,
    draft,
    slugHint: generateSlug(title || "", new Date(date.replace(" ", "T"))),
    content: content.replace(/\r\n/g, "\n").trim(),
    warnings,
  };

  return NextResponse.json({ payload });
}
