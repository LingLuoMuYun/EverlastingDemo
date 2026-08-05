"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { KIND_LABELS } from "../lib/types";
import { siteConfig } from "../siteConfig";

type Note = {
  slug: string;
  kind: "article" | "talk" | "moment";
  title?: string;
  date: string;
  updated?: string;
  description?: string;
  cover?: string;
  tags?: string[];
  mood?: string;
  location?: string;
  images?: string[];
  excerpt?: string;
  content?: string;
};

const KIND_COLORS: Record<string, string> = {
  article: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/10",
  talk: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/10",
  moment: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/10",
};

function displayTitle(note: Note): string {
  if (note.title) return note.title;
  const firstLine = (note.excerpt || note.content || "").split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
  return firstLine.replace(/^#+\s*/, "").slice(0, 40) || "碎片记录";
}

export default function NoteBoard({ notes }: { notes: Note[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string>("全部");
  const [activeTag, setActiveTag] = useState<string>("全部");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
    return ["全部", ...Array.from(set)];
  }, [notes]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      const matchKind = activeKind === "全部" || n.kind === activeKind;
      const matchTag = activeTag === "全部" || n.tags?.includes(activeTag);
      const matchSearch =
        !query ||
        displayTitle(n).toLowerCase().includes(query) ||
        (n.excerpt || "").toLowerCase().includes(query) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(query));
      return matchKind && matchTag && matchSearch;
    });
  }, [notes, searchQuery, activeKind, activeTag]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-10 py-6 md:py-10 pt-24 md:pt-28 relative z-10">
      <div className="mb-8 md:mb-14 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-tighter">
          {siteConfig.chatterTitle || "杂谈"}
        </h1>
        <p className="text-xs md:text-base text-slate-500 dark:text-slate-400 font-medium italic opacity-80">
          “ {siteConfig.chatterDescription || "日常碎片与灵感记录"} ”
        </p>
      </div>

      <div className="mb-8 md:mb-12 flex flex-col items-center gap-5 md:gap-8">
        <div className="relative w-full max-w-lg group px-2 md:px-0">
          <input
            type="text"
            placeholder="搜寻被遗忘的思绪..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 pl-10 md:pl-14 text-sm md:text-base text-slate-800 dark:text-white shadow-lg md:shadow-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-slate-400 font-medium"
          />
          <svg className="w-4 h-4 md:w-6 md:h-6 absolute left-5 md:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 px-2 md:px-0">
          {["全部", "article", "talk", "moment"].map((kind) => (
            <button
              key={kind}
              onClick={() => setActiveKind(kind)}
              className={`px-3 py-1.5 md:px-5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all duration-500 border ${
                activeKind === kind
                  ? "bg-indigo-500 text-white border-indigo-500 shadow-md md:shadow-lg md:shadow-indigo-500/30 scale-105"
                  : "bg-white/30 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 border-white/20 dark:border-white/5 hover:bg-white/60 dark:hover:bg-slate-700/60"
              }`}
            >
              {kind === "全部" ? kind : KIND_LABELS[kind as "article" | "talk" | "moment"]}
            </button>
          ))}
        </div>

        {allTags.length > 1 && (
          <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 px-2 md:px-0 max-w-3xl">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[9px] md:text-[10px] font-bold transition-all duration-300 border ${
                  activeTag === tag
                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                    : "bg-white/30 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 border-white/20 dark:border-white/5 hover:bg-white/60 dark:hover:bg-slate-700/60"
                }`}
              >
                {tag === "全部" ? tag : `# ${tag}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length > 0 ? (
        <motion.div layout className="columns-2 lg:columns-3 gap-3 md:gap-6 space-y-3 md:space-y-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((note) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={note.slug}
                className="break-inside-avoid"
              >
                <Link
                  href={`/notes/${note.slug}`}
                  className="block rounded-2xl md:rounded-[32px] bg-white/40 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/50 dark:border-white/5 shadow-md md:shadow-xl hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
                >
                  {note.cover && (
                    <div className="w-full h-28 md:h-52 overflow-hidden relative">
                      <img src={note.cover} alt="cover" referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
                      <span className={`absolute top-2 right-2 md:top-4 md:right-4 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest border backdrop-blur-md ${KIND_COLORS[note.kind]} bg-white/30 dark:bg-slate-900/40`}>
                        {KIND_LABELS[note.kind]}
                      </span>
                    </div>
                  )}

                  <div className="p-3 md:p-7">
                    <div className="flex items-center justify-between mb-2 md:mb-4">
                      <div className="text-[8px] md:text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider md:tracking-[0.2em] bg-indigo-500/5 dark:bg-indigo-400/10 px-1.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg border border-indigo-500/10">
                        {note.date.split(" ")[0]}
                      </div>
                      {!note.cover && (
                        <span className={`text-[8px] md:text-[10px] font-black px-1.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg border ${KIND_COLORS[note.kind]}`}>
                          {KIND_LABELS[note.kind]}
                        </span>
                      )}
                      {!note.cover && note.mood && (
                        <span className="text-[8px] md:text-[10px] font-black text-pink-600 dark:text-pink-400 bg-pink-500/5 dark:bg-pink-400/10 px-1.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg border border-pink-500/10">
                          ✨ {note.mood}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm md:text-xl font-bold text-slate-800 dark:text-white mb-1.5 md:mb-4 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 md:line-clamp-none">
                      {displayTitle(note)}
                    </h3>

                    <div className="text-[10px] md:text-sm text-slate-600 dark:text-slate-300 leading-snug md:leading-relaxed line-clamp-4 md:line-clamp-5 opacity-90 font-medium italic whitespace-pre-wrap break-words">
                      {note.excerpt || displayTitle(note)}
                    </div>

                    {note.location && (
                      <div className="mt-2 md:mt-3 text-[9px] md:text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        📍 {note.location}
                      </div>
                    )}

                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-3 md:mt-6 flex flex-wrap gap-1 md:gap-2">
                        {note.tags.map((t) => (
                          <span key={t} className="text-[8px] md:text-[9px] font-black text-slate-500 dark:text-slate-400 bg-slate-500/5 dark:bg-white/5 px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-md border border-slate-500/10 dark:border-white/5">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center">
          <div className="text-4xl mb-4">🫧</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">这里还什么都没有，去写一篇吧。</p>
        </div>
      )}
    </div>
  );
}
