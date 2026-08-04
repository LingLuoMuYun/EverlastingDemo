"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-4xl font-black text-slate-800 dark:text-white mb-4">页面加载出错</h1>
        <p className="text-slate-500 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:scale-105 transition-transform"
        >
          重试
        </button>
      </div>
    </div>
  );
}
