/**
 * gray-matter（js-yaml）会把未加引号的 YYYY-MM-DD Frontmatter 解析成 Date 对象，
 * 直接渲染会触发 React "Objects are not valid as a React child" 错误。
 * 这里统一把 Date 转回 YYYY-MM-DD 字符串，字符串则原样保留。
 */
export function normalizeDate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
