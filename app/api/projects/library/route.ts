import { NextResponse } from "next/server";
import { toPublicProjects } from "../../../../lib/projects";

// 项目读取（公开）：data/projects/library.json → 过滤草稿、按 order 排序后返回
export async function GET() {
  return NextResponse.json(toPublicProjects());
}
