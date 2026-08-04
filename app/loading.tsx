export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-indigo-300 border-t-indigo-600 animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse">加载中...</p>
      </div>
    </div>
  );
}
