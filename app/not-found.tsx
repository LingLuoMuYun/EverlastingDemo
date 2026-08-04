import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-black text-slate-300 dark:text-slate-700">404</h1>
        <p className="text-slate-500 mt-4 mb-6">页面不存在</p>
        <Link
          href="/"
          className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:scale-105 transition-transform"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
