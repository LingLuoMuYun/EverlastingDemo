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
