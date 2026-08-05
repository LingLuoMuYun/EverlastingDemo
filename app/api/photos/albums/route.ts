import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { addAlbum, updateAlbum, moveAlbum, removeAlbum, getPhotoLibrary } from "../../../../lib/photos";
import { autopushPhotos } from "../../../../lib/autopush";

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

function deleteLocalPhotoFile(url: string) {
  const src = url.replace(/^\//, "");
  const publicDir = path.resolve(process.cwd(), "public");
  const filePath = path.resolve(publicDir, src);
  const photosRoot = path.resolve(publicDir, "uploads", "photos");
  if (filePath.startsWith(photosRoot + path.sep) && fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

// 相册管理：新增 / 更新（含排序 move）/ 删除（可选连带删本地图片）
export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "缺少相册标题" }, { status: 400 });
  try {
    const album = addAlbum({
      title,
      description: body.description,
      date: body.date,
      cover: body.cover,
    });
    const push = await autopushPhotos(`chore(photos): 新增相册 ${album.title}`);
    return NextResponse.json({ album, push }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const id = String(body.id);
    if (body.move === -1 || body.move === 1) {
      moveAlbum(id, body.move);
      const library = getPhotoLibrary();
      const album = library.albums.find((a) => a.id === id);
      const push = await autopushPhotos(`chore(photos): 移动相册 ${album?.title || id}`);
      return NextResponse.json({ album, push });
    }
    const patch = { ...body } as Record<string, unknown>;
    delete patch.id;
    const album = updateAlbum(id, patch as { title?: string; description?: string; date?: string; cover?: string; order?: number });
    const push = await autopushPhotos(`chore(photos): 更新相册 ${album.title}`);
    return NextResponse.json({ album, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const deleteFiles = req.nextUrl.searchParams.get("deleteFiles") === "1";
  try {
    const album = removeAlbum(id);
    if (deleteFiles) album.photos.forEach((p) => deleteLocalPhotoFile(p.url));
    const push = await autopushPhotos(`chore(photos): 删除相册 ${album.title}`);
    return NextResponse.json({ id, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
