import { NextRequest, NextResponse } from "next/server";
import { importPlaylist } from "../../../../../../lib/music-import";
import { autopushMusic } from "../../../../../../lib/autopush";

const isProd = process.env.NODE_ENV === "production";

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

// 网易云歌单批量导入（仅本地）：逐首抓歌词 + 去重入库，返回导入报告
export async function POST(req: NextRequest) {
  if (isProd) {
    return NextResponse.json({ error: "生产环境只读：请在本地运行 npm run dev 使用管理后台" }, { status: 403 });
  }
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !/^\d+$/.test(String(body.playlistId || ""))) {
    return NextResponse.json({ error: "参数缺失：需要 playlistId（数字）" }, { status: 400 });
  }

  try {
    const report = await importPlaylist({
      playlistId: String(body.playlistId),
      skipExisting: body.skipExisting !== false,
      maxSongs: Number(body.maxSongs) || 50,
      tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : undefined,
      collectionId: typeof body.collectionId === "string" && body.collectionId ? body.collectionId : undefined,
    });
    const push = await autopushMusic(`chore(music): 歌单导入 ${report.playlist.name}`);
    return NextResponse.json({ report, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 502 });
  }
}
