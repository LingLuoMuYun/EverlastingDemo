// lib/photos.ts —— 照片墙数据层（仿 lib/music.ts）
// 唯一权威数据源：data/photos/library.json；管理后台 / API / 前台页面都从这里读
import fs from "fs";
import path from "path";
import { getCached, clearCache } from "./cache";

export const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");
export const PHOTOS_LIBRARY_PATH = path.join(PHOTOS_DIR, "library.json");

export interface PhotoItem {
  id: string;
  url: string;
  caption?: string;
  takenAt?: string;
  order: number;
}

export interface PhotoAlbum {
  id: string;
  title: string;
  description: string;
  cover: string; // 空 = 自动回退第一张
  date: string;
  order: number;
  photos: PhotoItem[];
}

export interface PhotoLibrary {
  version: number;
  albums: PhotoAlbum[];
}

const CACHE_KEY = "photos:library";
const ID_RE = /^[a-z0-9-]+$/;

export function isValidPhotoId(id: string): boolean {
  return ID_RE.test(id);
}

export function generateAlbumId(title: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const slug =
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `album-${Date.now().toString(36)}`;
  return `album-${prefix}-${slug}`;
}

export function generatePhotoId(): string {
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function validateAlbum(album: PhotoAlbum): string[] {
  const errors: string[] = [];
  if (!isValidPhotoId(album.id)) errors.push(`相册 id 非法: ${album.id}`);
  if (!album.title) errors.push(`${album.id}: 缺少 title`);
  if (!album.date || isNaN(new Date(album.date).getTime())) errors.push(`${album.id}: date 缺失或不可解析`);
  if (!Number.isInteger(album.order)) errors.push(`${album.id}: order 应为整数`);
  if (!Array.isArray(album.photos)) errors.push(`${album.id}: photos 应为数组`);
  else {
    const photoIds = new Set<string>();
    album.photos.forEach((p) => {
      if (!isValidPhotoId(p.id)) errors.push(`${album.id}/${p.id}: 照片 id 非法`);
      if (photoIds.has(p.id)) errors.push(`${album.id}/${p.id}: 照片 id 重复`);
      photoIds.add(p.id);
      if (!p.url) errors.push(`${album.id}/${p.id}: 缺少 url`);
      if (!Number.isInteger(p.order)) errors.push(`${album.id}/${p.id}: order 应为整数`);
    });
  }
  return errors;
}

function normalizeLibrary(raw: PhotoLibrary): PhotoLibrary {
  const albums = (Array.isArray(raw?.albums) ? raw.albums : [])
    .map((a) => {
      const normalized: PhotoAlbum = {
        ...a,
        description: a.description || "",
        cover: a.cover || "",
        photos: Array.isArray(a.photos)
          ? a.photos
              .filter((p) => p && p.url)
              .sort((x, y) => x.order - y.order)
          : [],
      };
      const errors = validateAlbum(normalized);
      if (errors.length) {
        console.warn(`[photos] ${errors.join("; ")}`);
        return null;
      }
      return normalized;
    })
    .filter((a): a is PhotoAlbum => a !== null)
    .sort((a, b) => a.order - b.order);
  return { version: 1, albums };
}

export function getPhotoLibrary(): PhotoLibrary {
  const fetcher = (): PhotoLibrary => {
    if (!fs.existsSync(PHOTOS_LIBRARY_PATH)) return { version: 1, albums: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(PHOTOS_LIBRARY_PATH, "utf8")) as PhotoLibrary;
      return normalizeLibrary(raw);
    } catch (err) {
      console.error("[photos] library.json 解析失败:", err);
      return { version: 1, albums: [] };
    }
  };
  return getCached(CACHE_KEY, fetcher);
}

export function savePhotoLibrary(library: PhotoLibrary) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  fs.writeFileSync(PHOTOS_LIBRARY_PATH, JSON.stringify(normalizeLibrary(library), null, 2) + "\n", "utf8");
  clearCache(CACHE_KEY);
}

export function addAlbum(input: { title: string; description?: string; date?: string; cover?: string; order?: number }) {
  const library = getPhotoLibrary();
  const id = generateAlbumId(input.title);
  if (library.albums.some((a) => a.id === id)) throw new Error(`相册已存在: ${id}`);
  const maxOrder = library.albums.reduce((m, a) => Math.max(m, a.order), 0);
  const album: PhotoAlbum = {
    id,
    title: input.title.trim(),
    description: input.description?.trim() || "",
    cover: input.cover?.trim() || "",
    date: input.date?.trim() || new Date().toISOString().slice(0, 10),
    order: input.order ?? maxOrder + 1,
    photos: [],
  };
  const errors = validateAlbum(album);
  if (errors.length) throw new Error(errors.join("; "));
  savePhotoLibrary({ ...library, albums: [...library.albums, album] });
  return album;
}

export function updateAlbum(id: string, patch: Partial<Omit<PhotoAlbum, "id" | "photos">>) {
  const library = getPhotoLibrary();
  const index = library.albums.findIndex((a) => a.id === id);
  if (index < 0) throw new Error(`相册不存在: ${id}`);
  if (patch.title !== undefined && !patch.title.trim()) throw new Error("相册标题不能为空");
  const albums = [...library.albums];
  albums[index] = {
    ...albums[index],
    ...patch,
    id,
    title: patch.title?.trim() || albums[index].title,
    description: patch.description !== undefined ? patch.description.trim() : albums[index].description,
    cover: patch.cover !== undefined ? patch.cover.trim() : albums[index].cover,
  };
  savePhotoLibrary({ ...library, albums });
  return albums[index];
}

/** 相册上移/下移（与相邻相册交换 order） */
export function moveAlbum(id: string, dir: -1 | 1) {
  const library = getPhotoLibrary();
  const sorted = [...library.albums].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((a) => a.id === id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[target];
  const albums = library.albums.map((x) => {
    if (x.id === a.id) return { ...x, order: b.order };
    if (x.id === b.id) return { ...x, order: a.order };
    return x;
  });
  savePhotoLibrary({ ...library, albums });
}

export function removeAlbum(id: string) {
  const library = getPhotoLibrary();
  const album = library.albums.find((a) => a.id === id);
  if (!album) throw new Error(`相册不存在: ${id}`);
  savePhotoLibrary({ ...library, albums: library.albums.filter((a) => a.id !== id) });
  return album;
}

export function addPhoto(
  albumId: string,
  input: { url: string; caption?: string; takenAt?: string; order?: number }
) {
  const library = getPhotoLibrary();
  const album = library.albums.find((a) => a.id === albumId);
  if (!album) throw new Error(`相册不存在: ${albumId}`);
  const maxOrder = album.photos.reduce((m, p) => Math.max(m, p.order), 0);
  const photo: PhotoItem = {
    id: generatePhotoId(),
    url: input.url.trim(),
    caption: input.caption?.trim() || undefined,
    takenAt: input.takenAt?.trim() || undefined,
    order: input.order ?? maxOrder + 1,
  };
  if (!photo.url) throw new Error("照片缺少 url");
  const albums = library.albums.map((a) => (a.id === albumId ? { ...a, photos: [...a.photos, photo] } : a));
  savePhotoLibrary({ ...library, albums });
  return photo;
}

export function updatePhoto(albumId: string, photoId: string, patch: Partial<Omit<PhotoItem, "id">>) {
  const library = getPhotoLibrary();
  const album = library.albums.find((a) => a.id === albumId);
  if (!album) throw new Error(`相册不存在: ${albumId}`);
  const index = album.photos.findIndex((p) => p.id === photoId);
  if (index < 0) throw new Error(`照片不存在: ${photoId}`);
  const albums = library.albums.map((a) => {
    if (a.id !== albumId) return a;
    const photos = [...a.photos];
    photos[index] = {
      ...photos[index],
      ...patch,
      id: photoId,
      caption: patch.caption !== undefined ? (patch.caption || "").trim() || undefined : photos[index].caption,
    };
    return { ...a, photos };
  });
  savePhotoLibrary({ ...library, albums });
  return albums.find((a) => a.id === albumId)!.photos[index];
}

/** 照片上移/下移（相册内与相邻照片交换 order） */
export function movePhoto(albumId: string, photoId: string, dir: -1 | 1) {
  const library = getPhotoLibrary();
  const album = library.albums.find((a) => a.id === albumId);
  if (!album) throw new Error(`相册不存在: ${albumId}`);
  const sorted = [...album.photos].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((p) => p.id === photoId);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= sorted.length) return;
  const a = sorted[idx];
  const b = sorted[target];
  const albums = library.albums.map((x) => {
    if (x.id !== albumId) return x;
    return {
      ...x,
      photos: x.photos.map((p) => {
        if (p.id === a.id) return { ...p, order: b.order };
        if (p.id === b.id) return { ...p, order: a.order };
        return p;
      }),
    };
  });
  savePhotoLibrary({ ...library, albums });
}

export function removePhoto(albumId: string, photoId: string) {
  const library = getPhotoLibrary();
  const album = library.albums.find((a) => a.id === albumId);
  if (!album) throw new Error(`相册不存在: ${albumId}`);
  const photo = album.photos.find((p) => p.id === photoId);
  if (!photo) throw new Error(`照片不存在: ${photoId}`);
  const albums = library.albums.map((a) =>
    a.id === albumId ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) } : a
  );
  savePhotoLibrary({ ...library, albums });
  return photo;
}

/** 相册组合：封面空则回退第一张照片 */
export function composeAlbum(album: PhotoAlbum): PhotoAlbum {
  const photos = [...album.photos].sort((a, b) => a.order - b.order);
  return { ...album, cover: album.cover || photos[0]?.url || "", photos };
}

export function toPublicPhotoLibrary(): { version: number; albums: PhotoAlbum[] } {
  const library = getPhotoLibrary();
  return { version: library.version, albums: library.albums.map(composeAlbum) };
}
