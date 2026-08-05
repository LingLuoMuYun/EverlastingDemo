import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "notes");
const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * 本地编辑器图片上传：仅开发环境可写，保存到 public/uploads/notes 并随 git push 部署。
 * 生产环境（Vercel）文件系统只读，返回 403，图片需本地放入仓库后提交。
 */
export async function POST(req: NextRequest) {
  if (isProd) {
    return NextResponse.json(
      { error: "生产环境只读：图片请放入本地 public/uploads/notes 后 git push 发布" },
      { status: 403 }
    );
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段（multipart/form-data）" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "图片不能超过 8MB" }, { status: 413 });
  }

  const ext = ALLOWED_TYPES[file.type.toLowerCase()];
  if (!ext) {
    return NextResponse.json(
      { error: "仅支持 PNG / JPG / GIF / WebP / AVIF 格式" },
      { status: 400 }
    );
  }

  // 文件名完全由服务端生成，不采用用户文件名，避免路径穿越
  const name = `note-${nowStamp()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const target = path.join(UPLOAD_DIR, name);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(target, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/notes/${name}` }, { status: 201 });
}
