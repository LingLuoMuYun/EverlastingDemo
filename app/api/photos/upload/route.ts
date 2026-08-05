import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "photos");
const MAX_MB = Number(process.env.PHOTO_MAX_MB || 10);
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
};
const EXT_BY_NAME: Record<string, string> = {
  ".png": "png",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".gif": "gif",
  ".webp": "webp",
  ".avif": "avif",
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

/** 轻量魔数嗅探，拦截伪装成图片的文件 */
function sniffImage(buf: Buffer, ext: string): boolean {
  switch (ext) {
    case "png":
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case "jpg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "gif":
      return buf.subarray(0, 4).toString("latin1") === "GIF8";
    case "webp":
      return buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
    case "avif":
      return buf.subarray(4, 12).toString("latin1").startsWith("ftyp");
    default:
      return true;
  }
}

// 照片上传（可多张）：仅本地，保存到 public/uploads/photos 并随 git push 部署
export async function POST(req: NextRequest) {
  if (isProd) {
    return NextResponse.json(
      { error: "生产环境只读：图片请放入本地 public/uploads/photos 后 git push 发布" },
      { status: 403 }
    );
  }
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const files = form?.getAll("files") as File[] | undefined;
  if (!files || files.length === 0) {
    return NextResponse.json({ error: "缺少 files 字段（multipart/form-data，可多张）" }, { status: 400 });
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const uploaded: Array<{ url: string; file: string; size: number; name: string }> = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const file of files) {
    const ext =
      ALLOWED_TYPES[file.type.toLowerCase()] ||
      EXT_BY_NAME[path.extname(file.name).toLowerCase()];
    if (!ext) {
      errors.push({ name: file.name, error: "仅支持 PNG / JPG / GIF / WebP / AVIF 格式" });
      continue;
    }
    if (file.size <= 0) {
      errors.push({ name: file.name, error: "文件为空" });
      continue;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      errors.push({ name: file.name, error: `图片不能超过 ${MAX_MB}MB` });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!sniffImage(buf, ext)) {
      errors.push({ name: file.name, error: "文件内容与格式不符（已拦截非图片文件）" });
      continue;
    }
    const name = `photo-${nowStamp()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    uploaded.push({ url: `/uploads/photos/${name}`, file: `uploads/photos/${name}`, size: file.size, name: file.name });
  }

  return NextResponse.json(
    { files: uploaded, errors },
    { status: uploaded.length > 0 ? 201 : 400 }
  );
}
