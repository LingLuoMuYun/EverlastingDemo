import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { addPhoto, updatePhoto, movePhoto, reorderPhotos, removePhoto } from "../../../../lib/photos";
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

// 照片管理：新增 / 更新（含排序 move）/ 删除（可选连带删本地图片）
export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.albumId || !body?.url) return NextResponse.json({ error: "缺少 albumId 或 url" }, { status: 400 });
  try {
    const photo = addPhoto(String(body.albumId), {
      url: String(body.url),
      caption: body.caption,
      takenAt: body.takenAt,
    });
    const push = await autopushPhotos(`chore(photos): 新增照片`);
    return NextResponse.json({ photo, push }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.albumId) return NextResponse.json({ error: "缺少 albumId" }, { status: 400 });
  try {
    const albumId = String(body.albumId);
    if (Array.isArray(body.reorder)) {
      reorderPhotos(albumId, body.reorder.map((x: unknown) => String(x)));
      const push = await autopushPhotos(`chore(photos): 重排照片`);
      return NextResponse.json({ albumId, reorder: body.reorder, push });
    }
    const photoId = String(body.photoId || "");
    if (!photoId) return NextResponse.json({ error: "缺少 photoId" }, { status: 400 });
    if (body.move === -1 || body.move === 1) {
      movePhoto(albumId, photoId, body.move);
      const push = await autopushPhotos(`chore(photos): 移动照片`);
      return NextResponse.json({ albumId, photoId, push });
    }
    const patch = { ...body } as Record<string, unknown>;
    delete patch.albumId;
    delete patch.photoId;
    const photo = updatePhoto(albumId, photoId, patch as { caption?: string; takenAt?: string; order?: number });
    const push = await autopushPhotos(`chore(photos): 更新照片`);
    return NextResponse.json({ photo, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const albumId = req.nextUrl.searchParams.get("albumId") || "";
  const photoId = req.nextUrl.searchParams.get("photoId") || "";
  if (!albumId || !photoId) return NextResponse.json({ error: "缺少 albumId 或 photoId" }, { status: 400 });
  const deleteFile = req.nextUrl.searchParams.get("deleteFile") === "1";
  try {
    const photo = removePhoto(albumId, photoId);
    if (deleteFile) deleteLocalPhotoFile(photo.url);
    const push = await autopushPhotos(`chore(photos): 删除照片`);
    return NextResponse.json({ albumId, photoId, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
