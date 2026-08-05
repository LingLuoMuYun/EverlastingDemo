import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import {
  toPublicLibrary,
  addTrack,
  updateTrack,
  removeTrack,
  generateLocalId,
  type MusicTrack,
} from "../../../../lib/music";
import { fetchNeteaseTrack } from "../../../../lib/netease";
import { autopushMusic } from "../../../../lib/autopush";

const isProd = process.env.NODE_ENV === "production";

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

// 播放器读取曲库（公开）：data/music/library.json → 合成 src 后返回
export async function GET() {
  return NextResponse.json(toPublicLibrary());
}

export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "参数缺失" }, { status: 400 });

  try {
    if (body.source === "netease") {
      const neteaseId = String(body.neteaseId || "").trim();
      if (!/^\d+$/.test(neteaseId)) return NextResponse.json({ error: "neteaseId 非法" }, { status: 400 });
      const meta = await fetchNeteaseTrack(neteaseId);
      const track = addTrack({ ...meta, order: typeof body.order === "number" ? body.order : undefined });
      const push = await autopushMusic(`chore(music): 新增 ${track.title}`);
      return NextResponse.json({ track, push }, { status: 201 });
    }

    if (body.source === "local") {
      const file = String(body.file || "").trim();
      if (!file) return NextResponse.json({ error: "缺少 file（请先上传音频）" }, { status: 400 });
      const title = String(body.title || "").trim();
      if (!title) return NextResponse.json({ error: "缺少 title" }, { status: 400 });
      const track = addTrack({
        id: String(body.id || generateLocalId(title)),
        source: "local",
        file,
        title,
        artist: String(body.artist || "").trim() || "未知歌手",
        album: String(body.album || "").trim() || undefined,
        cover: String(body.cover || "").trim() || undefined,
        lyrics:
          typeof body.lyrics === "string"
            ? { lrc: body.lyrics }
            : undefined,
        order: typeof body.order === "number" ? body.order : undefined,
      });
      const push = await autopushMusic(`chore(music): 新增 ${track.title}`);
      return NextResponse.json({ track, push }, { status: 201 });
    }

    return NextResponse.json({ error: "source 非法（netease/local）" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "参数缺失：需要 id" }, { status: 400 });
  }
  try {
    const { id, ...patch } = body as Record<string, unknown> & { id: string };
    const track = updateTrack(String(id), patch as Partial<Omit<MusicTrack, "id">>);
    const push = await autopushMusic(`chore(music): 更新 ${track.title}`);
    return NextResponse.json({ track, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const deleteFile = req.nextUrl.searchParams.get("deleteFile") === "1";

  try {
    const library = toPublicLibrary();
    const target = library.tracks.find((t) => t.id === id);
    removeTrack(id);

    // 可选：连带删除本地音频（仅限 public/music 内，防止路径穿越）
    if (deleteFile && target && target.source === "local") {
      const src = target.src.replace(/^\//, "");
      const publicDir = path.resolve(process.cwd(), "public");
      const filePath = path.resolve(publicDir, src);
      const musicRoot = path.resolve(publicDir, "music");
      if (filePath.startsWith(musicRoot + path.sep) && fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    }

    const push = await autopushMusic(`chore(music): 删除 ${id}`);
    return NextResponse.json({ id, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
