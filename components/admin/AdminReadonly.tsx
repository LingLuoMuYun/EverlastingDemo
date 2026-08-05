import Link from "next/link";

// 生产环境只读提示：Vercel 文件系统只读，管理后台仅本地 dev 可用
export default function AdminReadonly() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-2xl p-8 md:p-12 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3">
          管理后台仅本地可用
        </h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          线上（Vercel）文件系统只读，请在本地运行{" "}
          <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs">
            npm run dev
          </code>{" "}
          后打开 <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-xs">/admin</code>{" "}
          管理内容，保存后 git push 发布。
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-black shadow-lg hover:bg-indigo-600 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
