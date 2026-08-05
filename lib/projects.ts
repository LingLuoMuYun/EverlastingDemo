// lib/projects.ts —— 项目数据层（仿 lib/photos.ts）
// 唯一权威数据源：data/projects/library.json；管理后台 / API / 前台页面都从这里读
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";

export const PROJECTS_DIR = path.join(process.cwd(), "data", "projects");
export const PROJECTS_LIBRARY_PATH = path.join(PROJECTS_DIR, "library.json");

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  githubUrl: string;
  tags: string[];
  order: number;
  draft?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectLibrary {
  version: number;
  projects: Project[];
}

const CACHE_KEY = "projects:library";
const ID_RE = /^[a-z0-9-]+$/;

export function isValidProjectId(id: string): boolean {
  return ID_RE.test(id);
}

/** 生成 project-yyyyMMdd-<拉丁标题slug>，标题无拉丁字符时回退时间戳 */
export function generateProjectId(name: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `project-${prefix}-${slug || Date.now().toString(36)}`;
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );
}

function validateProject(project: Project): string[] {
  const errors: string[] = [];
  if (!isValidProjectId(project.id)) errors.push(`项目 id 非法: ${project.id}`);
  if (!project.name || !project.name.trim()) errors.push(`${project.id}: 缺少 name`);
  if (!Number.isInteger(project.order)) errors.push(`${project.id}: order 应为整数`);
  if (!Array.isArray(project.tags)) errors.push(`${project.id}: tags 应为数组`);
  if (project.githubUrl && !/^https?:\/\//.test(project.githubUrl)) {
    errors.push(`${project.id}: githubUrl 应为 http(s) 链接`);
  }
  return errors;
}

function normalizeLibrary(raw: ProjectLibrary): ProjectLibrary {
  const projects = (Array.isArray(raw?.projects) ? raw.projects : [])
    .map((p) => {
      const normalized: Project = {
        ...p,
        name: String(p.name || "").trim(),
        description: String(p.description || "").trim(),
        icon: String(p.icon || "").trim(),
        githubUrl: String(p.githubUrl || "").trim(),
        tags: normalizeTags(p.tags),
        draft: Boolean(p.draft),
      };
      const errors = validateProject(normalized);
      if (errors.length) {
        console.warn(`[projects] ${errors.join("; ")}`);
        return null;
      }
      return normalized;
    })
    .filter((p): p is Project => p !== null)
    .sort((a, b) => a.order - b.order);
  return { version: 1, projects };
}

export function getProjects(): ProjectLibrary {
  const fetcher = (): ProjectLibrary => {
    if (!fs.existsSync(PROJECTS_LIBRARY_PATH)) return { version: 1, projects: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(PROJECTS_LIBRARY_PATH, "utf8")) as ProjectLibrary;
      return normalizeLibrary(raw);
    } catch (err) {
      console.error("[projects] library.json 解析失败:", err);
      return { version: 1, projects: [] };
    }
  };
  return getCached(CACHE_KEY, fetcher);
}

/** 前台可见（过滤草稿，按 order 排序） */
export function getPublicProjects(): Project[] {
  return getProjects().projects.filter((p) => !p.draft);
}

export function saveProjects(library: ProjectLibrary) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(PROJECTS_LIBRARY_PATH, JSON.stringify(normalizeLibrary(library), null, 2) + "\n", "utf8");
  clearCache(CACHE_KEY);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function addProject(input: {
  name: string;
  description?: string;
  icon?: string;
  githubUrl?: string;
  tags?: string[];
  draft?: boolean;
}) {
  const library = getProjects();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("项目名称不能为空");
  const id = generateProjectId(name);
  if (library.projects.some((p) => p.id === id)) throw new Error(`项目已存在: ${id}`);
  const maxOrder = library.projects.reduce((m, p) => Math.max(m, p.order), 0);
  const project: Project = {
    id,
    name,
    description: input.description?.trim() || "",
    icon: input.icon?.trim() || "",
    githubUrl: input.githubUrl?.trim() || "",
    tags: normalizeTags(input.tags),
    order: maxOrder + 1,
    draft: Boolean(input.draft),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const errors = validateProject(project);
  if (errors.length) throw new Error(errors.join("; "));
  saveProjects({ ...library, projects: [...library.projects, project] });
  return project;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id" | "createdAt">>) {
  const library = getProjects();
  const index = library.projects.findIndex((p) => p.id === id);
  if (index < 0) throw new Error(`项目不存在: ${id}`);
  const current = library.projects[index];
  const nextName = patch.name !== undefined ? String(patch.name).trim() : current.name;
  if (!nextName) throw new Error("项目名称不能为空");
  const projects = [...library.projects];
  projects[index] = {
    ...current,
    ...patch,
    id,
    name: nextName,
    description: patch.description !== undefined ? String(patch.description).trim() : current.description,
    icon: patch.icon !== undefined ? String(patch.icon).trim() : current.icon,
    githubUrl: patch.githubUrl !== undefined ? String(patch.githubUrl).trim() : current.githubUrl,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
    draft: patch.draft !== undefined ? Boolean(patch.draft) : current.draft,
    updatedAt: nowIso(),
  };
  const errors = validateProject(projects[index]);
  if (errors.length) throw new Error(errors.join("; "));
  saveProjects({ ...library, projects });
  return projects[index];
}

/** 上移/下移（与相邻项目交换 order） */
export function moveProject(id: string, dir: -1 | 1) {
  const library = getProjects();
  const sorted = [...library.projects].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((p) => p.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[target];
  const projects = library.projects.map((p) => {
    if (p.id === a.id) return { ...p, order: b.order };
    if (p.id === b.id) return { ...p, order: a.order };
    return p;
  });
  saveProjects({ ...library, projects });
}

/** 按给定 id 顺序整组重排（拖拽排序用，未知 id 保持原 order） */
export function reorderProjects(ids: string[]) {
  const library = getProjects();
  const orderMap = new Map(ids.map((id, i) => [id, i + 1]));
  const projects = library.projects.map((p) => (orderMap.has(p.id) ? { ...p, order: orderMap.get(p.id)! } : p));
  saveProjects({ ...library, projects });
}

export function removeProject(id: string) {
  const library = getProjects();
  const project = library.projects.find((p) => p.id === id);
  if (!project) throw new Error(`项目不存在: ${id}`);
  saveProjects({ ...library, projects: library.projects.filter((p) => p.id !== id) });
  return project;
}

/** 公开读取：过滤草稿、排序后返回（供前台页面与 /api/projects/library） */
export function toPublicProjects() {
  return {
    version: 1,
    projects: getPublicProjects(),
  };
}
