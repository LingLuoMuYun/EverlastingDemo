import { NextRequest, NextResponse } from "next/server";
import { renderMarkdown } from "../../../../lib/markdown";

const isProd = process.env.NODE_ENV === "production";
const MAX_SIZE = 512 * 1024; // 512KB，与编辑器单篇笔记规模相比足够宽裕

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: NextRequest) {
  // 生产环境渲染接口仅对持有 EDITOR_TOKEN 的请求开放（前台页面走服务端渲染，不依赖此 API）
  if (isProd && !checkAuth(req)) {
    return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content 缺失" }, { status: 400 });
  }
  if (content.length > MAX_SIZE) {
    return NextResponse.json({ error: "内容过大，请控制在 512KB 以内" }, { status: 413 });
  }
  const html = await renderMarkdown(content);
  return NextResponse.json({ html });
}
