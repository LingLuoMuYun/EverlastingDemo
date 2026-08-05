import { NextRequest, NextResponse } from "next/server";
import { previewPlaylist } from "../../../../../../lib/music-import";

const isProd = process.env.NODE_ENV === "production";

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

// 网易云歌单预览（仅本地）：歌单信息 + 歌曲列表 + 库内重复标记，不写库
export async function GET(req: NextRequest) {
  if (isProd) {
    return NextResponse.json({ error: "生产环境只读：请在本地运行 npm run dev 使用管理后台" }, { status: 403 });
  }
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "歌单 ID 非法" }, { status: 400 });

  try {
    const preview = await previewPlaylist(id);
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 502 });
  }
}
