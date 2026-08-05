import { NextRequest, NextResponse } from "next/server";
import { fetchNeteaseTrack, checkAudioUrl, composeNeteaseSrc } from "../../../../../lib/netease";

const isProd = process.env.NODE_ENV === "production";

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

// 网易云 ID 预览（仅本地）：详情 + 歌词 + 音频可用性，不写库
export async function GET(req: NextRequest) {
  if (isProd) {
    return NextResponse.json(
      { error: "生产环境只读：请在本地运行 npm run dev 使用管理后台" },
      { status: 403 }
    );
  }
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "neteaseId 非法" }, { status: 400 });
  }

  try {
    const track = await fetchNeteaseTrack(id);
    const audio = await checkAudioUrl(composeNeteaseSrc(id));
    return NextResponse.json({
      ...track,
      audioOk: audio.ok,
      audioType: audio.type,
      audioSize: audio.size,
    });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 502 });
  }
}
