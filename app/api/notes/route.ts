import { NextRequest, NextResponse } from "next/server";
import {
  getAllNotesMeta,
  getNote,
  getNoteMtime,
  saveNote,
  deleteNote,
  isValidSlug,
  validateNoteMeta,
} from "../../../lib/notes";
import { autopushNotes } from "../../../lib/autopush";

const isProd = process.env.NODE_ENV === "production";

function forbidWrites() {
  return NextResponse.json(
    { error: "生产环境只读：请编辑本地 notes/*.md 后 git push 发布" },
    { status: 403 }
  );
}

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

function now() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function GET() {
  return NextResponse.json(getAllNotesMeta({ includeDraft: true }));
}

export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== "object" || body.data === null || typeof body.content !== "string") {
    return NextResponse.json({ error: "参数缺失：需要 data 与 content" }, { status: 400 });
  }
  const slug = String(body.slug || "");
  if (!isValidSlug(slug)) return NextResponse.json({ error: "slug 非法" }, { status: 400 });
  if (getNote(slug, { includeDraft: true })) return NextResponse.json({ error: "slug 已存在" }, { status: 409 });
  const errors = validateNoteMeta(slug, body.data);
  if (errors.length) return NextResponse.json({ error: errors.join("；") }, { status: 400 });
  saveNote({ slug, data: { ...body.data, updated: now() }, content: body.content });
  const push = await autopushNotes(`chore(notes): 新建 ${slug}`);
  return NextResponse.json({ slug, push }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== "object" || body.data === null || typeof body.content !== "string") {
    return NextResponse.json({ error: "参数缺失：需要 slug、data 与 content" }, { status: 400 });
  }
  const slug = String(body.slug || "");
  if (!isValidSlug(slug)) return NextResponse.json({ error: "slug 非法" }, { status: 400 });
  if (!getNote(slug, { includeDraft: true })) return NextResponse.json({ error: "笔记不存在" }, { status: 404 });

  // 冲突检测：客户端携带保存前的 mtime，磁盘已被外部修改则 409
  const expectedMtime = Number(body.expectedMtime);
  if (Number.isFinite(expectedMtime) && expectedMtime > 0) {
    const currentMtime = getNoteMtime(slug);
    if (currentMtime !== null && Math.abs(currentMtime - expectedMtime) > 1) {
      return NextResponse.json({ error: "文件已在其他地方被修改", currentMtime }, { status: 409 });
    }
  }

  const errors = validateNoteMeta(slug, body.data);
  if (errors.length) return NextResponse.json({ error: errors.join("；") }, { status: 400 });
  saveNote({ slug, data: { ...body.data, updated: now() }, content: body.content });
  const push = await autopushNotes(`chore(notes): 更新 ${slug}`);
  return NextResponse.json({ slug, push });
}

export async function DELETE(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!isValidSlug(slug)) return NextResponse.json({ error: "slug 非法" }, { status: 400 });
  if (!getNote(slug, { includeDraft: true })) return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
  deleteNote(slug);
  const push = await autopushNotes(`chore(notes): 删除 ${slug}`);
  return NextResponse.json({ slug, push });
}
