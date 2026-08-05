import { NextRequest, NextResponse } from "next/server";
import {
  addFriend,
  updateFriend,
  moveFriend,
  reorderFriends,
  removeFriend,
  getFriends,
} from "../../../lib/friends";
import { autopushFriends } from "../../../lib/autopush";

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

// 友链管理：新增 / 更新（含排序 move / reorder）/ 删除
export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "缺少友链名称" }, { status: 400 });
  try {
    const friend = addFriend({
      name,
      url: body.url,
      description: body.description,
      avatar: body.avatar,
      themeColor: body.themeColor,
      status: body.status === "offline" ? "offline" : "online",
      draft: body.draft === true,
    });
    const push = await autopushFriends(`chore(friends): 新增友链 ${friend.name}`);
    return NextResponse.json({ friend, push }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (Array.isArray(body?.reorder)) {
      reorderFriends(body.reorder.map((x: unknown) => String(x)));
      const push = await autopushFriends("chore(friends): 重排友链");
      return NextResponse.json({ reorder: body.reorder, push });
    }
    if (!body?.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const id = String(body.id);
    if (body.move === -1 || body.move === 1) {
      moveFriend(id, body.move);
      const library = getFriends();
      const friend = library.friends.find((f) => f.id === id);
      const push = await autopushFriends(`chore(friends): 移动友链 ${friend?.name || id}`);
      return NextResponse.json({ friend, push });
    }
    const patch = { ...body } as Record<string, unknown>;
    delete patch.id;
    delete patch.move;
    const friend = updateFriend(
      id,
      patch as {
        name?: string;
        url?: string;
        description?: string;
        avatar?: string;
        themeColor?: string;
        status?: "online" | "offline";
        draft?: boolean;
      }
    );
    const push = await autopushFriends(`chore(friends): 更新友链 ${friend.name}`);
    return NextResponse.json({ friend, push });
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
    const friend = removeFriend(id);
    const push = await autopushFriends(`chore(friends): 删除友链 ${friend.name}`);
    return NextResponse.json({ id, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
