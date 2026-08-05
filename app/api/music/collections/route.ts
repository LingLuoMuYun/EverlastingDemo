import { NextRequest, NextResponse } from "next/server";
import { addCollection, updateCollection, removeCollection } from "../../../../lib/music";
import { autopushMusic } from "../../../../lib/autopush";

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

// 歌单（collection）管理：新增 / 更新 / 删除，全部本地限定
export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "缺少歌单名称" }, { status: 400 });
  try {
    const collection = addCollection(name, typeof body.cover === "string" ? body.cover : undefined);
    const push = await autopushMusic(`chore(music): 新增歌单 ${collection.name}`);
    return NextResponse.json({ collection, push }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    const { id, ...patch } = body as Record<string, unknown> & { id: string };
    const collection = updateCollection(String(id), patch as { name?: string; cover?: string; order?: number });
    const push = await autopushMusic(`chore(music): 更新歌单 ${collection.name}`);
    return NextResponse.json({ collection, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  try {
    removeCollection(id);
    const push = await autopushMusic(`chore(music): 删除歌单 ${id}`);
    return NextResponse.json({ id, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
