export interface AutopushResult {
  ok: boolean;
  committed: boolean;
  error?: string;
}

// 保存后自动 git push 的状态条（成功/失败原因截断 200 字符）
export default function AutopushBanner({ result }: { result: AutopushResult | null }) {
  if (!result) return null;
  return (
    <div
      className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm border ${
        result.ok
          ? "bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-300"
          : "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300"
      }`}
    >
      {result.ok
        ? `✓ 已保存并推送 GitHub${result.committed ? "（含新提交）" : "（无新改动，已同步远端）"}`
        : `⚠ 已保存到本地，但自动推送失败：${(result.error || "未知错误").slice(0, 200)}`}
    </div>
  );
}
