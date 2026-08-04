import { NextRequest, NextResponse } from "next/server";
import { renderMarkdown } from "../../../../lib/markdown";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content 缺失" }, { status: 400 });
  }
  const html = await renderMarkdown(content);
  return NextResponse.json({ html });
}
