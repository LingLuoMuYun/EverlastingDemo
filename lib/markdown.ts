import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { unified } from "unified";
import { toPlainExcerpt } from "./notes";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import type { TocItem } from "./types";
import type { Root, Element, RootContent } from "hast";

const HIGHLIGHT_SUBSET = [
  "cpp", "c", "python", "java", "javascript", "typescript",
  "go", "rust", "bash", "json", "html", "css", "sql", "xml",
];

/** 允许保留的标签（内容型），其余一律移除 */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "a", "img", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "blockquote", "pre", "code", "kbd", "samp", "var",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "sub", "sup", "mark", "small", "abbr", "cite", "q", "time",
  "details", "summary", "figure", "figcaption", "audio", "video", "source", "track",
]);

/** 允许的 URL 协议（图片额外放行 data:image/） */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", "#", "/"]);
const URL_ATTRIBUTES = new Set(["href", "src", "poster", "action", "formaction", "xlink:href"]);

function isSafeUrl(value: string, tagName: string, attr: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (attr === "src" && tagName === "img" && trimmed.startsWith("data:image/")) return true;
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  try {
    const proto = new URL(trimmed, "https://x").protocol;
    return SAFE_PROTOCOLS.has(proto);
  } catch {
    return false;
  }
}

/**
 * 输出前消毒：移除危险标签 / on* 事件属性 / javascript: 等危险 URL。
 * 必须在 rehype-raw 之后执行（否则原始 HTML 仍是 raw 节点，无法逐元素处理）。
 */
function rehypeSanitizeHtml() {
  return (tree: Root) => {
    const walk = (parent: Root | Element) => {
      parent.children = parent.children.filter((child) => {
        if (child.type !== "element") return true;
        const el = child as Element;
        if (!ALLOWED_TAGS.has(el.tagName)) return false;
        if (el.properties) {
          for (const key of Object.keys(el.properties)) {
            if (key.toLowerCase().startsWith("on")) delete el.properties[key];
          }
          for (const attr of URL_ATTRIBUTES) {
            const value = el.properties[attr];
            if (typeof value === "string" && !isSafeUrl(value, el.tagName, attr)) {
              delete el.properties[attr];
            }
          }
        }
        walk(el);
        return true;
      });
    };
    walk(tree);
  };
}

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

/**
 * 把飞书导出中转义成 \| 的表格行还原为 GFM 表格语法（跳过代码块）。
 * 飞书导出形如：\| a \| b \|（含 \-\-\- 分隔行），未还原时 remark-gfm 不识别为表格。
 * 还原后若表格紧跟非空行（常见为列表项惰性延续），补一个空行让表格独立成块，
 * 否则 remark-gfm 仍会把它当作段落/列表项文本。
 * 仅在整行以 \| 开头、以 \| 结尾时处理，避免误伤普通转义内容。
 */
export function normalizeFeishuTableRows(content: string): string {
  const blocks = content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) return block; // 代码块原样保留
      const lines = block.split("\n");
      const out: string[] = [];
      let prevLine = "";
      let prevWasTableRow = false;
      for (const line of lines) {
        if (/^[ \t]*\\\|.*\\\|[ \t]*$/.test(line)) {
          if (!prevWasTableRow && prevLine.trim() !== "") out.push("");
          out.push(line.replace(/\\\|/g, "|").replace(/\\-/g, "-"));
          prevWasTableRow = true;
        } else {
          out.push(line);
          prevWasTableRow = false;
        }
        prevLine = line;
      }
      return out.join("\n");
    })
    .join("");
}

/** 文本预清洗：统一换行 → 修数字列表 → 还原飞书转义表格 → 代码块保护 → 正文连续空行转 <br>（顺序与源码一致） */
export function preprocessContent(content: string): string {
  content = content.replace(/\r\n/g, "\n").replace(/^[ \t]+$/gm, "");
  content = content.replace(/^(\s*\d+)\.([^ \n])/gm, "$1. $2");
  content = normalizeFeishuTableRows(content);
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
    .use(rehypeRaw)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true, subset: HIGHLIGHT_SUBSET })
    .use(rehypeKatex)
    .use(rehypeSanitizeHtml)
    .use(rehypeNoReferrerImages)
    .use(rehypeStringify)
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
        excerpt: typeof meta.description === "string" ? meta.description : toPlainExcerpt(content, 100),
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
