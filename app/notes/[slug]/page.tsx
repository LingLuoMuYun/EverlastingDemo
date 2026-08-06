import Link from "next/link";
import { notFound } from "next/navigation";

import Navbar from "../../../components/Navbar";
import PageTransition from "../../../components/PageTransition";
import BackButton from "../../../components/BackButton";
import ClientSocials from "../../../components/ClientSocials";
import ClientTOC from "../../../components/ClientTOC";
import SidebarLyric from "../../../components/SidebarLyric";
import ProseStyles from "../../../components/ProseStyles";
import { getAllNotesMeta, getNote } from "../../../lib/notes";
import { renderMarkdown, extractToc } from "../../../lib/markdown";
import { KIND_LABELS } from "../../../lib/types";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export async function generateStaticParams() {
  return getAllNotesMeta().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note || note.draft) return { title: "内容不存在 | " + siteConfig.title };
  return {
    title: `${note.title || "碎片记录"} | ${siteConfig.title}`,
    description: note.description || note.excerpt || "",
  };
}

export default async function NoteDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note || note.draft) notFound();

  const contentHtml = await renderMarkdown(note.content);
  const toc = note.kind === "article" ? extractToc(note.content) : [];
  const recentNotes = getAllNotesMeta().filter((n) => n.slug !== slug).slice(0, 3);
  const title = note.title || note.content.split("\n").map((l) => l.trim()).find((l) => l.length > 0)?.replace(/^#+\s*/, "") || "碎片记录";

  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] md:w-[90%] max-w-6xl mx-auto mt-24 md:mt-28 flex flex-col lg:flex-row gap-6 md:gap-8 relative z-10">
          <article className="flex-1 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden transition-colors duration-700">
            {note.cover && (
              <div className="w-full aspect-video bg-slate-200 dark:bg-slate-700 relative group">
                <img src={note.cover} alt="封面" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105" />
              </div>
            )}

            <div className="p-5 md:p-14 relative">
              <BackButton />

              <header className="mb-6 md:mb-10 border-b border-slate-300/30 dark:border-slate-700/50 pb-5 md:pb-8 relative">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border bg-indigo-500/5 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10">
                    {KIND_LABELS[note.kind]}
                  </span>
                  {note.draft && (
                    <span className="text-[10px] md:text-xs font-black px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      草稿
                    </span>
                  )}
                </div>

                <h1 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 md:mb-6 tracking-tight transition-colors duration-700 pr-16 md:pr-24 leading-snug md:leading-tight">
                  {title}
                </h1>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div className="flex items-center gap-1.5 md:gap-2 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-500/5 dark:bg-indigo-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm border border-indigo-500/10">
                    <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {note.date}
                  </div>

                  {note.updated && note.updated !== note.date && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold bg-slate-500/5 dark:bg-slate-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm border border-slate-500/10">
                      更新于 {note.updated}
                    </div>
                  )}

                  {note.mood && (
                    <div className="flex items-center gap-1.5 md:gap-2 text-pink-600 dark:text-pink-400 font-black bg-pink-500/5 dark:bg-pink-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm border border-pink-500/10">
                      ✨ 心情：{note.mood}
                    </div>
                  )}

                  {note.location && (
                    <div className="flex items-center gap-1.5 md:gap-2 text-sky-600 dark:text-sky-400 font-bold bg-sky-500/5 dark:bg-sky-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm border border-sky-500/10">
                      📍 {note.location}
                    </div>
                  )}

                  {note.tags?.map((tag) => (
                    <div key={tag} className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold bg-slate-500/5 dark:bg-slate-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm border border-slate-500/10">
                      <span className="text-[10px] md:text-xs opacity-70">#</span> {tag}
                    </div>
                  ))}
                </div>
              </header>

              <ProseStyles />
              <div
                className="prose prose-slate dark:prose-invert prose-base md:prose-lg max-w-none text-slate-800 dark:text-slate-200 font-serif transition-colors duration-700 leading-relaxed scroll-smooth"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />

            </div>
          </article>

          <aside className="w-full lg:w-[320px] flex flex-col gap-6 flex-shrink-0">
            <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-white/10 shadow-xl text-center">
              <div className="w-20 h-20 mx-auto rounded-full p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md mb-4 hover:rotate-3 transition-transform">
                <img src={siteConfig.avatarUrl} alt="avatar" className="w-full h-full rounded-full object-cover bg-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{siteConfig.authorName}</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium mb-4">{siteConfig.bio}</p>
              <ClientSocials />
            </div>

            <SidebarLyric />

            {recentNotes.length > 0 && (
              <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 dark:border-white/10 shadow-xl">
                <h3 className="font-black text-slate-900 dark:text-white mb-4 border-l-4 border-indigo-500 pl-2 text-xs tracking-widest uppercase">
                  Recent Records
                </h3>
                <div className="space-y-4">
                  {recentNotes.map((p) => (
                    <Link key={p.slug} href={`/notes/${p.slug}`} className="group block">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {p.title || p.slug}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold uppercase">{p.date}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {toc.length > 0 && <ClientTOC toc={toc} />}
          </aside>
        </main>
      </PageTransition>
    </div>
  );
}
