import { NextResponse } from "next/server";
import { toPublicFriends } from "../../../../lib/friends";

// 友链读取（公开）：data/friends/library.json → 过滤草稿、按 order 排序后返回
export async function GET() {
  return NextResponse.json(toPublicFriends());
}
