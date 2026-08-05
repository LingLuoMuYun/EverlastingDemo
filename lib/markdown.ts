import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import type { TocItem } from "./types";
import type { Root, Element, RootContent } from "hast";

const HIGHLIGHT_SUBSET = [
  "cpp", "c", "python", "java", "javascript", "typescript",
  "go", "rust", "bash", "json", "html", "css", "sql", "xml",
];

/**
 * 给渲染出的 <img> 统一加 referrerPolicy="no-referrer"，
 * 避免图床按 Referer 防盗链拦截（本地/线上页面加载外链图都会携带本站 Referer）。
 */
function rehypeNoReferrerImages() {
  return (tree: Root) => {
    const visit = (node: RootContent) => {
      if (node.type !== "element") return;
      const el = node as Element;
      if (el.tagName === "img") {
        el.properties = { ...el.properties, referrerPolicy: "no-referrer" };
      }
      el.children.forEach(visit);
    };
    tree.children.forEach(visit);
  };
}

/** 文本预清洗：统一换行 → 修数字列表 → 代码块保护 → 正文连续空行转 <br>（顺序与源码一致） */
export function preprocessContent(content: string): string {
  content = content.replace(/\r\n/g, "\n").replace(/^[ \t]+$/gm, "");
  content = content.replace(/^(\s*\d+)\.([^ \n])/gm, "$1. $2");
  const blocks = content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) {
        if (/^```[ \t]*(\n|$)/.test(block)) {
          return block.replace(/^```[ \t]*/, "```cpp");
        }
        return block; // 代码块原样保留
      }
      return block.replace(/\n{3,}/g, (match) => {
        const brCount = match.length - 2;
        return "\n\n" + "<br>".repeat(brCount) + "\n\n";
      });
    })
    .join("");
}

export async function renderMarkdown(content: string): Promise<string> {
  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, { detect: true, ignoreMissing: true, subset: HIGHLIGHT_SUBSET })
    .use(rehypeKatex)
    .use(rehypeNoReferrerImages)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(preprocessContent(content));
  return processed.toString();
}

export interface MarkdownFile {
  slug: string;
  content: string;
  excerpt: string;
  date: string;
  [key: string]: unknown;
}

export interface MarkdownPage extends Record<string, unknown> {
  contentHtml: string;
}

export function getAllMarkdownFiles(dirName: string): MarkdownFile[] {
  const dir = path.join(process.cwd(), dirName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((fileName) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, fileName), "utf8"));
      const meta = data as Record<string, unknown>;
      return {
        slug: fileName.replace(/\.md$/, ""),
        ...meta,
        content,
        excerpt: typeof meta.description === "string" ? meta.description : content.substring(0, 100),
      } as MarkdownFile;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getMarkdownPage(filePath: string): Promise<MarkdownPage | null> {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return null;
  const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));
  return { ...(data as Record<string, unknown>), contentHtml: await renderMarkdown(content) };
}

export function extractToc(content: string): TocItem[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    toc.push({
      level: match[1].length,
      text: match[2].trim(),
      id: match[2].trim().toLowerCase().replace(/\s+/g, "-"),
    });
  }
  return toc;
}
