import { NextRequest, NextResponse } from "next/server";
import { fetchFeishuDoc, FeishuError } from "../../../../../lib/feishu";
import { generateSlug } from "../../../../../lib/notes";
import type { MarkdownImportPayload } from "../../../../../lib/types";

const isProd = process.env.NODE_ENV === "production";

function checkAuth(req: NextRequest): boolean {
  const token = process.env.EDITOR_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

function nowString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  if (isProd) {
    return NextResponse.json({ error: "生产环境只读：飞书导入仅本地开发可用" }, { status: 403 });
  }
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "请粘贴飞书文档分享链接" }, { status: 400 });
  }

  try {
    const { title, content } = await fetchFeishuDoc(url);
    const warnings = [
      "默认导入为「文章」，可在编辑器中改为「杂谈」",
      "日期已使用当前时间，可在编辑器中修改",
    ];
    const payload: MarkdownImportPayload = {
      source: "feishu",
      sourceName: title || "飞书文档",
      kind: "article",
      title,
      date: nowString(),
      tags: [],
      slugHint: generateSlug(title || "", new Date()),
      content: content.replace(/\r\n/g, "\n").trim(),
      warnings,
    };
    return NextResponse.json({ payload });
  } catch (err) {
    if (err instanceof FeishuError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "导入失败，请稍后重试" }, { status: 500 });
  }
}
