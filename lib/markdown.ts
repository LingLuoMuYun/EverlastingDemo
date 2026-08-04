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

const HIGHLIGHT_SUBSET = [
  "cpp", "c", "python", "java", "javascript", "typescript",
  "go", "rust", "bash", "json", "html", "css", "sql", "xml",
];

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
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(preprocessContent(content));
  return processed.toString();
}

export function getAllMarkdownFiles(dirName: string) {
  const dir = path.join(process.cwd(), dirName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((fileName) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, fileName), "utf8"));
      return {
        slug: fileName.replace(/\.md$/, ""),
        ...data,
        content,
        excerpt: data.description || content.substring(0, 100),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getMarkdownPage(filePath: string) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return null;
  const { data, content } = matter(fs.readFileSync(fullPath, "utf8"));
  return { ...data, contentHtml: await renderMarkdown(content) };
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
