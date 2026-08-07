import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function BackLink() {
  return (
    <Link
      href="/toolbox"
      className="group inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all duration-300 mb-8 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full shadow-sm w-max"
    >
      <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
      返回工具箱
    </Link>
  );
}
