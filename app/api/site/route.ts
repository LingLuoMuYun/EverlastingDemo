import { NextRequest, NextResponse } from "next/server";
import { getPublicSiteConfig, saveSiteConfig } from "../../../lib/site";
import { autopushSite } from "../../../lib/autopush";

const isProd = process.env.NODE_ENV === "production";

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

// 站点配置读取（公开）：返回默认值 + 覆盖值深合并后的完整配置
export async function GET() {
  return NextResponse.json(getPublicSiteConfig());
}

// 站点配置保存（仅本地）：白名单校验 + 写回 data/site/config.json + 自动推送
export async function PUT(req: NextRequest) {
  if (isProd) {
    return NextResponse.json(
      { error: "生产环境只读：请在本地运行 npm run dev 使用管理后台" },
      { status: 403 },
    );
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求体应为对象" }, { status: 400 });
  }
  try {
    const config = saveSiteConfig((body.values as Record<string, unknown>) ?? {});
    const push = await autopushSite("chore(site): 更新站点配置");
    return NextResponse.json({ ok: true, config, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
