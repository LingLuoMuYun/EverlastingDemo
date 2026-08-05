import { NextResponse } from "next/server";
import { toPublicPhotoLibrary } from "../../../../lib/photos";

// 照片墙读取（公开）：data/photos/library.json → 封面回退、按 order 排序后返回
export async function GET() {
  return NextResponse.json(toPublicPhotoLibrary());
}
