import { NextRequest, NextResponse } from "next/server";
import {
  addProject,
  updateProject,
  moveProject,
  reorderProjects,
  removeProject,
  getProjects,
} from "../../../lib/projects";
import { autopushProjects } from "../../../lib/autopush";

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

function parseTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.map((t) => String(t)) : [];
}

// 项目管理：新增 / 更新（含排序 move / reorder）/ 删除
export async function POST(req: NextRequest) {
  if (isProd) return forbidWrites();
  if (!checkAuth(req)) return NextResponse.json({ error: "未授权（EDITOR_TOKEN 不匹配）" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "缺少项目名称" }, { status: 400 });
  try {
    const project = addProject({
      name,
      description: body.description,
      icon: body.icon,
      githubUrl: body.githubUrl,
      tags: parseTags(body.tags),
      draft: body.draft === true,
    });
    const push = await autopushProjects(`chore(projects): 新增项目 ${project.name}`);
    return NextResponse.json({ project, push }, { status: 201 });
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
      reorderProjects(body.reorder.map((x: unknown) => String(x)));
      const push = await autopushProjects("chore(projects): 重排项目");
      return NextResponse.json({ reorder: body.reorder, push });
    }
    if (!body?.id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    const id = String(body.id);
    if (body.move === -1 || body.move === 1) {
      moveProject(id, body.move);
      const library = getProjects();
      const project = library.projects.find((p) => p.id === id);
      const push = await autopushProjects(`chore(projects): 移动项目 ${project?.name || id}`);
      return NextResponse.json({ project, push });
    }
    const patch = { ...body } as Record<string, unknown>;
    delete patch.id;
    delete patch.move;
    if (patch.tags !== undefined) patch.tags = parseTags(patch.tags);
    const project = updateProject(
      id,
      patch as {
        name?: string;
        description?: string;
        icon?: string;
        githubUrl?: string;
        tags?: string[];
        draft?: boolean;
      }
    );
    const push = await autopushProjects(`chore(projects): 更新项目 ${project.name}`);
    return NextResponse.json({ project, push });
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
    const project = removeProject(id);
    const push = await autopushProjects(`chore(projects): 删除项目 ${project.name}`);
    return NextResponse.json({ id, push });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message || err) }, { status: 400 });
  }
}
