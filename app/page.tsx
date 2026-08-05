import Link from 'next/link';

import Navbar from '../components/Navbar';
import PageTransition from '../components/PageTransition';
import SearchBar from '../components/SearchBar';
import { siteConfig } from '../siteConfig';
import ThemeToggleBlock from '../components/ThemeToggleBlock';
import ProfileCard from '../components/ProfileCard';
import SiteDashboard from '../components/SiteDashboard';
import { albums } from '../data/albums';
import { ToastProvider } from '../components/ToastProvider';
import CloudPlayer from '../components/CloudPlayer';
import LyricBar from '../components/LyricBar';
import WeatherWidget from '../components/WeatherWidget';

import LatestNotesCarousel from '../components/LatestNotesCarousel';
import { getAllNotesMeta } from '../lib/notes';
import { KIND_LABELS } from '../lib/types';
import type { NoteMeta } from '../lib/types';

function formatUpdateTime(dateString: string) {
  if (!dateString || dateString === '1970-01-01') return '刚刚更新';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    if (hours === '00' && mins === '00') return `${year}.${month}.${day}`;
    return `${year}.${month}.${day} ${hours}:${mins}`;
  } catch { return dateString; }
}

type HomeNote = Omit<NoteMeta, "content"> & {
  title: string;
  description: string;
  formattedDate: string;
};

export default function Home() {
  // 🌟 内容整合：统一从 notes/ 读取（文章/杂谈/说说），draft 已在 lib/notes.ts 过滤
  let allNotes: HomeNote[] = [];
  try {
    allNotes = getAllNotesMeta().map(note => ({
      ...note,
      title: note.title || '碎片记录',
      description: note.description || note.excerpt || '',
      formattedDate: formatUpdateTime(note.date)
    }));
  } catch {}
  const top5Notes: HomeNote[] = allNotes.length > 0
    ? allNotes.slice(0, 5)
    : [{ slug: 'none', kind: 'article', title: '暂无内容', description: '快去写第一篇吧！', cover: siteConfig.defaultPostCover, date: '', formattedDate: '' }];
  const realPhotoCount = albums.reduce((total, album) => total + album.photos.length, 0);
  const latestAlbum = albums.length > 0 ? albums[0] : { id: '', title: '照片墙', description: '查看摄影', cover: siteConfig.photoWallImage, date: '' };

  return (
    <ToastProvider>
      <div className="min-h-screen relative pb-10">
        <Navbar />
        <PageTransition>
          {/* 🌟 调整整体容器的内边距，适应手机端更小的屏幕 */}
          <div className="w-full max-w-6xl mx-auto mt-24 sm:mt-28 px-4 sm:px-6 lg:px-10 relative z-10">
            <SearchBar posts={allNotes} />

            <main className="flex flex-col gap-6 w-full mt-6">

              {/* 第一行：个人信息 + 音乐卡片 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                <div className="col-span-1 lg:col-span-7 flex flex-col">
                    <ProfileCard noteCount={allNotes.length} photoCount={realPhotoCount}/>
                </div>
                <div className="col-span-1 lg:col-span-5 flex flex-col">
                    <CloudPlayer/>
                </div>
              </div>

              {/* 歌词栏 */}
              <div className="w-full mt-[-10px]"><LyricBar/></div>

              {/* 第二行：文章轮播 + 照片墙 + 说说 + 主题切换 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

                {/* 左侧：文章轮播 (电脑端占4列，手机端排最上面) */}
                <div className="col-span-1 lg:col-span-4 flex flex-col min-h-[300px]">
                  <LatestNotesCarousel notes={top5Notes} />
                </div>

                {/* 右侧：组合面板 (电脑端占8列) */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">

                  {/* 照片墙大海报 */}
                  <Link href="/photowall" className="w-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-700 hover:scale-[1.02] relative group min-h-[200px] sm:min-h-[220px] flex-shrink-0">
                    <img src={latestAlbum.cover} alt="" className="w-full h-full absolute inset-0 object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"/>
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/50 group-hover:bg-black/10 transition-colors duration-500"></div>
                    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-6">
                      <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 underline decoration-pink-400">{latestAlbum.title}</h3>
                      <p className="text-white/90 text-sm sm:text-lg line-clamp-1">{latestAlbum.description}</p>
                    </div>
                  </Link>

                  {/* 底层网格：最新动态 + 主题切换器 */}
                  {/* 手机上单列，平板上分3列比例分布 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full flex-1">
                    <div className="sm:col-span-2 flex flex-col min-h-[200px]">
                      <div className="rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/5 shadow-md md:shadow-xl overflow-hidden flex-1">
                        <div className="p-4 md:p-6 border-b border-slate-200/40 dark:border-slate-700/40 flex items-center justify-between">
                          <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-white tracking-wider">最新动态</h3>
                          <Link href="/notes" className="text-[10px] md:text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">查看全部 →</Link>
                        </div>
                        <div className="p-3 md:p-5 flex flex-col">
                          {top5Notes.map((n, i) => (
                            <Link
                              key={n.slug}
                              href={n.slug === 'none' ? '/notes' : `/notes/${n.slug}`}
                              className="flex items-center gap-3 px-2 py-2.5 md:py-3 rounded-xl hover:bg-indigo-500/5 dark:hover:bg-indigo-400/5 transition-colors group/list"
                            >
                              <span className="w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[9px] md:text-[10px] font-black">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover/list:text-indigo-600 dark:group-hover/list:text-indigo-400 transition-colors">
                                  {n.title || '碎片记录'}
                                </div>
                                <div className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-0.5">{n.formattedDate}</div>
                              </div>
                              <span className="text-[9px] md:text-[10px] font-black px-1.5 md:px-2 py-0.5 rounded-md border shrink-0 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-400/10 border-indigo-500/10">
                                {KIND_LABELS[n.kind as 'article' | 'talk' | 'moment'] || '笔记'}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex flex-col gap-6">
                      <div className="min-h-[120px] flex-1"><ThemeToggleBlock /></div>
                      <div className="min-h-[120px]"><WeatherWidget /></div>
                    </div>
                  </div>

                </div>
              </div>

              {/* 底部数据面板 */}
              <div className="w-full mt-4"><SiteDashboard/></div>
            </main>
          </div>
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
