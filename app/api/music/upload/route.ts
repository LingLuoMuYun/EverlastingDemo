import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const ALLOWED_EXT = [".mp3", ".m4a", ".flac", ".ogg", ".wav"];
const MAX_MB = Number(process.env.MUSIC_MAX_MB || 50);

function forbidWrites() {
  return NextResponse.json(
    { error: "生产环境只读：请在本地运行 npm run dev 使用管理后台" },
    { status: 403 }
  );
}

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

/** 轻量魔数嗅探，拦截伪装成音频的文件 */
function sniffAudio(buf: Buffer, ext: string): boolean {
  const head = buf.subarray(0, 12);
  switch (ext) {
    case ".mp3":
      return head.subarray(0, 3).toString("latin1") === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
    case ".m4a":
      return head.subarray(4, 8).toString("latin1") === "ftyp";
    case ".flac":
      return head.subarray(0, 4).toString("latin1") === "fLaC";
    case ".ogg":
      return head.subarray(0, 4).toString("latin1") === "OggS";
    case ".wav":
      return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WAVE";
    default:
      return true;
  }
}

export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `不支持的格式：${ext}（支持 ${ALLOWED_EXT.join(" ")}）` }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `超过大小上限 ${MAX_MB}MB` }, { status: 413 });
  }

  const base =
    file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "audio";
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dir = path.join(process.cwd(), "public", "music");
  fs.mkdirSync(dir, { recursive: true });

  let name = `${day}-${base}${ext}`;
  let filePath = path.join(dir, name);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    name = `${day}-${base}-${counter}${ext}`;
    filePath = path.join(dir, name);
    counter++;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffAudio(buf, ext)) {
    return NextResponse.json({ error: "文件内容与扩展名不符（已拦截非音频文件）" }, { status: 400 });
  }
  fs.writeFileSync(filePath, buf);

  return NextResponse.json(
    { file: `music/${name}`, url: `/music/${name}`, size: file.size, name: file.name },
    { status: 201 }
  );
}
