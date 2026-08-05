// lib/friends.ts —— 友链数据层（仿 lib/projects.ts）
// 唯一权威数据源：data/friends/library.json；管理后台 / API / 前台页面都从这里读
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";

export const FRIENDS_DIR = path.join(process.cwd(), "data", "friends");
export const FRIENDS_LIBRARY_PATH = path.join(FRIENDS_DIR, "library.json");

export interface Friend {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  themeColor: string;
  status?: "online" | "offline";
  order: number;
  draft?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FriendLibrary {
  version: number;
  friends: Friend[];
}

const CACHE_KEY = "friends:library";
const ID_RE = /^[a-z0-9-]+$/;
const URL_RE = /^https?:\/\//;
const HEX_RE = /^#(?:[0-9a-fA-F]{3,8})$/;

export function isValidFriendId(id: string): boolean {
  return ID_RE.test(id);
}

/** 生成 friend-yyyymmdd-<拉丁标题slug>，标题无拉丁字符时回退时间戳 */
export function generateFriendId(name: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `friend-${prefix}-${slug || Date.now().toString(36)}`;
}

function validateFriend(friend: Friend): string[] {
  const errors: string[] = [];
  if (!isValidFriendId(friend.id)) errors.push(`友链 id 非法: ${friend.id}`);
  if (!friend.name || !friend.name.trim()) errors.push(`${friend.id}: 缺少 name`);
  if (!URL_RE.test(friend.url)) errors.push(`${friend.id}: url 应为 http(s) 链接`);
  if (friend.avatar && !URL_RE.test(friend.avatar)) errors.push(`${friend.id}: avatar 应为 http(s) 链接`);
  if (friend.themeColor && !HEX_RE.test(friend.themeColor)) errors.push(`${friend.id}: themeColor 应为 #hex 色值`);
  if (!Number.isInteger(friend.order)) errors.push(`${friend.id}: order 应为整数`);
  if (friend.status !== undefined && friend.status !== "online" && friend.status !== "offline") {
    errors.push(`${friend.id}: status 应为 online/offline`);
  }
  return errors;
}

function normalizeLibrary(raw: FriendLibrary): FriendLibrary {
  const friends = (Array.isArray(raw?.friends) ? raw.friends : [])
    .map((f) => {
      const normalized: Friend = {
        ...f,
        name: String(f.name || "").trim(),
        url: String(f.url || "").trim(),
        description: String(f.description || "").trim(),
        avatar: String(f.avatar || "").trim(),
        themeColor: String(f.themeColor || "").trim(),
        status: f.status === "offline" ? "offline" : "online",
        draft: Boolean(f.draft),
      };
      const errors = validateFriend(normalized);
      if (errors.length) {
        console.warn(`[friends] ${errors.join("; ")}`);
        return null;
      }
      return normalized;
    })
    .filter((f): f is Friend => f !== null)
    .sort((a, b) => a.order - b.order);
  return { version: 1, friends };
}

export function getFriends(): FriendLibrary {
  const fetcher = (): FriendLibrary => {
    if (!fs.existsSync(FRIENDS_LIBRARY_PATH)) return { version: 1, friends: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(FRIENDS_LIBRARY_PATH, "utf8")) as FriendLibrary;
      return normalizeLibrary(raw);
    } catch (err) {
      console.error("[friends] library.json 解析失败:", err);
      return { version: 1, friends: [] };
    }
  };
  return getCached(CACHE_KEY, fetcher);
}

/** 前台可见（过滤草稿，按 order 排序） */
export function getPublicFriends(): Friend[] {
  return getFriends().friends.filter((f) => !f.draft);
}

export function saveFriends(library: FriendLibrary) {
  fs.mkdirSync(FRIENDS_DIR, { recursive: true });
  fs.writeFileSync(FRIENDS_LIBRARY_PATH, JSON.stringify(normalizeLibrary(library), null, 2) + "\n", "utf8");
  clearCache(CACHE_KEY);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function addFriend(input: {
  name: string;
  url: string;
  description?: string;
  avatar?: string;
  themeColor?: string;
  status?: "online" | "offline";
  draft?: boolean;
}) {
  const library = getFriends();
  const name = String(input.name || "").trim();
  const url = String(input.url || "").trim();
  if (!name) throw new Error("友链名称不能为空");
  if (!URL_RE.test(url)) throw new Error("友链链接应为 http(s) 地址");
  const id = generateFriendId(name);
  if (library.friends.some((f) => f.id === id)) throw new Error(`友链已存在: ${id}`);
  const maxOrder = library.friends.reduce((m, f) => Math.max(m, f.order), 0);
  const friend: Friend = {
    id,
    name,
    url,
    description: input.description?.trim() || "",
    avatar: input.avatar?.trim() || "",
    themeColor: input.themeColor?.trim() || "",
    status: input.status === "offline" ? "offline" : "online",
    order: maxOrder + 1,
    draft: Boolean(input.draft),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const errors = validateFriend(friend);
  if (errors.length) throw new Error(errors.join("; "));
  saveFriends({ ...library, friends: [...library.friends, friend] });
  return friend;
}

export function updateFriend(id: string, patch: Partial<Omit<Friend, "id" | "createdAt">>) {
  const library = getFriends();
  const index = library.friends.findIndex((f) => f.id === id);
  if (index < 0) throw new Error(`友链不存在: ${id}`);
  const current = library.friends[index];
  const nextName = patch.name !== undefined ? String(patch.name).trim() : current.name;
  const nextUrl = patch.url !== undefined ? String(patch.url).trim() : current.url;
  if (!nextName) throw new Error("友链名称不能为空");
  if (!URL_RE.test(nextUrl)) throw new Error("友链链接应为 http(s) 地址");
  const friends = [...library.friends];
  friends[index] = {
    ...current,
    ...patch,
    id,
    name: nextName,
    url: nextUrl,
    description: patch.description !== undefined ? String(patch.description).trim() : current.description,
    avatar: patch.avatar !== undefined ? String(patch.avatar).trim() : current.avatar,
    themeColor: patch.themeColor !== undefined ? String(patch.themeColor).trim() : current.themeColor,
    status: patch.status === "offline" ? "offline" : patch.status === "online" ? "online" : current.status,
    draft: patch.draft !== undefined ? Boolean(patch.draft) : current.draft,
    updatedAt: nowIso(),
  };
  const errors = validateFriend(friends[index]);
  if (errors.length) throw new Error(errors.join("; "));
  saveFriends({ ...library, friends });
  return friends[index];
}

/** 上移/下移（与相邻友链交换 order） */
export function moveFriend(id: string, dir: -1 | 1) {
  const library = getFriends();
  const sorted = [...library.friends].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((f) => f.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[target];
  const friends = library.friends.map((f) => {
    if (f.id === a.id) return { ...f, order: b.order };
    if (f.id === b.id) return { ...f, order: a.order };
    return f;
  });
  saveFriends({ ...library, friends });
}

/** 按给定 id 顺序整组重排（拖拽排序用，未知 id 保持原 order） */
export function reorderFriends(ids: string[]) {
  const library = getFriends();
  const orderMap = new Map(ids.map((id, i) => [id, i + 1]));
  const friends = library.friends.map((f) => (orderMap.has(f.id) ? { ...f, order: orderMap.get(f.id)! } : f));
  saveFriends({ ...library, friends });
}

export function removeFriend(id: string) {
  const library = getFriends();
  const friend = library.friends.find((f) => f.id === id);
  if (!friend) throw new Error(`友链不存在: ${id}`);
  saveFriends({ ...library, friends: library.friends.filter((f) => f.id !== id) });
  return friend;
}

/** 公开读取：过滤草稿、排序后返回（供前台页面与 /api/friends/library） */
export function toPublicFriends() {
  return {
    version: 1,
    friends: getPublicFriends(),
  };
}
