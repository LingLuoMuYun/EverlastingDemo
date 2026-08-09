export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description?: string;
  cover?: string;
  tags?: string[];
  content: string;
  excerpt?: string;
}

/** 内容整合后的统一类型：article=文章 / talk=杂谈（杂谈已并入原说说） */
export type NoteKind = "article" | "talk";

export const KIND_LABELS: Record<NoteKind, string> = {
  article: "文章",
  talk: "杂谈",
};

export interface NoteMeta {
  slug: string;
  kind: NoteKind;
  title: string;
  date: string;
  updated?: string;
  description?: string;
  cover?: string;
  tags?: string[];
  mood?: string;
  location?: string;
  draft?: boolean;
  content: string;
  excerpt?: string;
}

export interface ChatterMeta extends PostMeta {
  mood?: string;
}

export interface Friend {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  themeColor: string;
}

export interface Photo {
  url: string;
  caption?: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  photos: Photo[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  githubUrl: string;
  tags: string[];
}

export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** 编辑器「导入」会话键：解析结果经 sessionStorage 传给新建页预填 */
export const IMPORT_SESSION_KEY = "note-import:new";

/** 导入解析结果（本地 .md / 飞书文档统一载荷） */
export interface MarkdownImportPayload {
  source: "file" | "feishu";
  /** 来源名：本地文件名或飞书文档标题 */
  sourceName: string;
  kind: NoteKind;
  title?: string;
  /** 与 NoteMeta.date 一致：YYYY-MM-DD 或 YYYY-MM-DD HH:MM */
  date: string;
  description?: string;
  cover?: string;
  tags: string[];
  mood?: string;
  location?: string;
  draft?: boolean;
  /** 建议 slug（文件名即 slug，用户在表单仍可修改） */
  slugHint: string;
  content: string;
  warnings?: string[];
}

/** 归档时间线展示用的笔记条目（不含正文） */
export interface TimelinePost {
  slug: string;
  kind: NoteKind;
  title: string;
  date: string;
  description?: string;
  tags: string[];
  cover: string;
}
