import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import { siteConfig } from "../../siteConfig";

export const metadata: Metadata = {
  title: `音乐 | ${siteConfig.title}`,
  description: siteConfig.bio,
};

export default function MusicPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-full max-w-4xl mx-auto mt-28 px-4 sm:px-6 lg:px-10 relative z-10">
          <div className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-10 text-center transition-colors duration-700">
            <h1 className="text-3xl font-black mb-3">音乐馆</h1>
            <p className="text-slate-500 dark:text-slate-400">
              音乐系统将在后续阶段上线（配置网易云歌曲 ID 后自动启用）。
            </p>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
