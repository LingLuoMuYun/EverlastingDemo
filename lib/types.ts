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

/** 内容整合后的统一类型：article=文章 / talk=杂谈 / moment=说说 */
export type NoteKind = "article" | "talk" | "moment";

export const KIND_LABELS: Record<NoteKind, string> = {
  article: "文章",
  talk: "杂谈",
  moment: "说说",
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
  images?: string[];
  draft?: boolean;
  content: string;
  excerpt?: string;
}

export interface ChatterMeta extends PostMeta {
  mood?: string;
}

export interface MomentMeta {
  id: string;
  date: string;
  location?: string;
  images?: string[];
  content: string;
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
