import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export interface PushResult {
  ok: boolean;
  committed: boolean;
  error?: string;
}

/** 串行化自动推送，避免并发保存时 git index.lock 冲突 */
let queue: Promise<unknown> = Promise.resolve();

function runGit(cwd: string, args: string[]): Promise<string> {
  return execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 }).then(
    (r) => r.stdout || r.stderr || ""
  );
}

/**
 * 本地后台保存后自动提交并推送指定目录：
 * - 只提交 targets 内路径，不动其他工作区改动
 * - 仅本地开发生效（生产 Vercel 只读，永远返回失败说明）
 * - 环境变量 AUTO_PUSH=0 可关闭
 */
export async function autopush(targets: string[], message: string): Promise<PushResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, committed: false, error: "生产环境不自动推送" };
  }
  if (process.env.AUTO_PUSH === "0") {
    return { ok: false, committed: false, error: "AUTO_PUSH=0 已关闭自动推送" };
  }

  const run = async (): Promise<PushResult> => {
    try {
      const cwd = process.cwd();
      const existingTargets = targets.filter((p) => fs.existsSync(path.join(cwd, p)));
      if (existingTargets.length === 0) {
        return { ok: false, committed: false, error: "没有可提交的目录" };
      }

      await runGit(cwd, ["add", ...existingTargets]);

      // 无改动时 commit 会失败（nothing to commit），此时仍尝试 push 保持远端一致
      let committed = false;
      try {
        await runGit(cwd, ["commit", "-m", message]);
        committed = true;
      } catch (err) {
        // 不同平台/版本的 git 可能把 "nothing to commit" 输出到 stderr 或 stdout，两个流都检查
        const output =
          String((err as { stderr?: string }).stderr || "") +
          String((err as { stdout?: string }).stdout || "");
        if (!/nothing to commit|no changes added|Changes not staged/i.test(output)) {
          throw err;
        }
      }

      await runGit(cwd, ["push", "origin", "HEAD"]);
      return { ok: true, committed };
    } catch (err) {
      const detail = String(
        (err as { stderr?: string }).stderr || (err as Error).message || err
      ).trim();
      return { ok: false, committed: false, error: detail.slice(0, 200) };
    }
  };

  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** 笔记编辑器：只提交 notes/ 与 public/uploads/notes */
export function autopushNotes(message: string): Promise<PushResult> {
  return autopush(["notes", "public/uploads/notes"], message);
}

/** 音乐管理后台：只提交 data/music 与 public/music */
export function autopushMusic(message: string): Promise<PushResult> {
  return autopush(["data/music", "public/music", "public/uploads/music"], message);
}
