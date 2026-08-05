import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { siteConfig } from '../../siteConfig';
import TimelineClient from '../../components/TimelineClient';
import { getAllNotesMeta } from '../../lib/notes';
import type { TimelinePost } from '../../lib/types';
// 🌟 1. 引入 ToastProvider 喵！
import { ToastProvider } from '../../components/ToastProvider';

export const metadata = {
  title: "归档与探索 | " + siteConfig.title,
};

export default async function Timeline({ searchParams }: { searchParams: Promise<{ kind?: string; tag?: string }> }) {
  const { kind, tag } = await searchParams;
  const posts: TimelinePost[] = [];
  const tagCounts: Record<string, number> = {};

  try {
    // 🌟 内容整合：归档统一读 notes/（文章/杂谈/说说），draft 已过滤
    const allNotes = getAllNotesMeta();
    allNotes.forEach(note => {
      const postTags = note.tags && note.tags.length > 0 ? note.tags : ['未分类'];
      postTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      posts.push({
        slug: note.slug,
        kind: note.kind,
        title: note.title || '碎片记录',
        date: note.date || '1970-01-01',
        description: note.description || '',
        tags: postTags,
        cover: note.cover || siteConfig.defaultPostCover,
      });
    });
  } catch(e) {
    console.error("读取笔记列表失败", e);
  }

  const tagsArray = Object.keys(tagCounts)
    .map(name => ({ name, count: tagCounts[name] }))
    .sort((a, b) => b.count - a.count);

  return (
    // 🌟 2. 在最外层用 ToastProvider 包裹整个页面
    <ToastProvider>
      <div className="min-h-screen relative pb-32">
        <Navbar />
        <PageTransition>
          <TimelineClient posts={posts} tags={tagsArray} initialKind={kind} initialTag={tag} />
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
