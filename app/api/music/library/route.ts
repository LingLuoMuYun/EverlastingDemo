import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import {
  toPublicLibrary,
  getLibrary,
  saveLibrary,
  addTrack,
  updateTrack,
  updateManyTracks,
  swapTracks,
  removeManyTracks,
  generateLocalId,
  type MusicTrack,
  type ComposedTrack,
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

/** 可选：删除本地音频文件（仅限 public/music 内，防止路径穿越） */
function deleteLocalAudioFile(track: ComposedTrack | null) {
  if (!track || track.source !== "local") return;
  const src = String(track.src || "").replace(/^\//, "");
  if (!src) return;
  const publicDir = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicDir, src);
  const musicRoot = path.resolve(publicDir, "music");
  if (filePath.startsWith(musicRoot + path.sep) && fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
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
      const track = addTrack({
        ...meta,
        order: typeof body.order === "number" ? body.order : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : undefined,
        collectionIds: typeof body.collectionId === "string" && body.collectionId ? [body.collectionId] : undefined,
      });
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
        duration: Number.isFinite(Number(body.duration)) ? Number(body.duration) : undefined,
        tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : undefined,
        collectionIds: typeof body.collectionId === "string" && body.collectionId ? [body.collectionId] : undefined,
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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "参数缺失" }, { status: 400 });
  try {
    // 相邻曲目交换排序（上移/下移），一次写入 + 一次推送
    if (Array.isArray(body.swap) && body.swap.length === 2) {
      const [idA, idB] = body.swap.map((x: unknown) => String(x));
      const tracks = swapTracks(idA, idB);
      const push = await autopushMusic("chore(music): 调整曲目顺序");
      return NextResponse.json({ tracks, push });
    }
    // 批量更新（设置标签 / 加入、移出歌单等），一次写入 + 一次推送
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.map((x: unknown) => String(x));
      // 歌单加入/移出需要按曲目当前归属合并，逐条生成新 collectionIds 后一次落盘
      if (body.collectionOp === "add" || body.collectionOp === "remove") {
        const collectionId = String(body.collectionId || "");
        if (!collectionId) return NextResponse.json({ error: "缺少 collectionId" }, { status: 400 });
        const library = getLibrary();
        const targetIds = new Set(ids);
        let changed = 0;
        const tracks = library.tracks.map((t) => {
          if (!targetIds.has(t.id)) return t;
          const current = t.collectionIds || [];
          const next =
            body.collectionOp === "add"
              ? [...new Set([...current, collectionId])]
              : current.filter((id) => id !== collectionId);
          changed++;
          return { ...t, collectionIds: next };
        });
        if (!changed) return NextResponse.json({ error: "没有可更新的曲目（id 不存在）" }, { status: 400 });
        saveLibrary({ ...library, tracks });
        const push = await autopushMusic(
          `chore(music): ${body.collectionOp === "add" ? "加入" : "移出"}歌单 ${ids.length} 首曲目`
        );
        return NextResponse.json({ ids, collectionId, push });
      }
      const patch = { ...body } as Record<string, unknown>;
      delete patch.ids;
      delete patch.swap;
      delete patch.collectionOp;
      delete patch.collectionId;
      const tracks = updateManyTracks(ids, patch as Partial<Omit<MusicTrack, "id">>);
      const push = await autopushMusic("chore(music): 批量更新曲目");
      return NextResponse.json({ tracks, push });
    }
    if (!body.id) return NextResponse.json({ error: "参数缺失：需要 id / ids / swap" }, { status: 400 });
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
  const ids = req.nextUrl.searchParams.getAll("id");
  if (!ids.length) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const deleteFile = req.nextUrl.searchParams.get("deleteFile") === "1";

  try {
    const library = toPublicLibrary();
    if (deleteFile) ids.forEach((id) => deleteLocalAudioFile(library.tracks.find((t) => t.id === id) ?? null));
    removeManyTracks(ids);
    const push = await autopushMusic(`chore(music): 删除 ${ids.length} 首曲目`);
    return NextResponse.json({ ids, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
