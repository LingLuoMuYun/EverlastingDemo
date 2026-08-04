import Navbar from "./Navbar";
import PageTransition from "./PageTransition";
import Link from "next/link";

// 生产环境提示：Vercel 文件系统只读，编辑器仅在本地 dev 可用
export default function EditorReadonly() {
  return (
    <div className="min-h-screen relative pb-16">
      <Navbar />
      <PageTransition>
        <div className="w-full max-w-2xl mx-auto px-4 pt-32 md:pt-40 relative z-10">
          <div className="rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl p-8 md:p-12 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3">编辑器仅在本地可用</h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              线上（Vercel）文件系统只读，请在本地运行 <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs">npm run dev</code>{" "}
              后打开 <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs">/editor</code> 写作，保存后 git push 发布。
            </p>
            <Link href="/notes" className="inline-block px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors">
              去「杂谈」看看
            </Link>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
