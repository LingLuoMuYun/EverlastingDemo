import { NextResponse } from "next/server";
import { toPublicLibrary } from "../../../../lib/music";

// 播放器读取曲库（公开）：data/music/library.json → 合成 src 后返回
export async function GET() {
  return NextResponse.json(toPublicLibrary());
}
