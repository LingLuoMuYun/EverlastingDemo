export interface Photo {
  id?: string;
  url: string;
  caption?: string;
  takenAt?: string;
  order?: number;
}

export interface Album {
  id?: string;
  title: string;
  description: string;
  cover: string;
  date: string;
  order?: number;
  photos: Photo[];
}

// 照片墙数据已迁移到 data/photos/library.json（lib/photos.ts 统一读取），
// 本文件仅保留类型定义供前台组件使用
