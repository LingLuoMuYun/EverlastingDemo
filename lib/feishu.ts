/**
 * 飞书开放平台客户端（阶段 2：在线文档导入）
 * - 文档内容以官方 Markdown 导出获取：GET /open-apis/docs/v1/content
 * - 鉴权：自建应用 tenant_access_token（2 小时过期，模块级缓存）
 * - 仅服务端使用：App Secret 绝不下发浏览器
 */

import { normalizeFeishuTableRows } from "./markdown";

const FEISHU_BASE = process.env.FEISHU_BASE_URL || "https://open.feishu.cn";
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "";
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";

/** 允许的域名后缀（国内 feishu.cn / 国际 larksuite.com / larkoffice.com） */
const ALLOWED_HOST_RE = /(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/i;

const TOKEN_RE = /^[A-Za-z0-9]{22,27}$/;

let cachedToken: { token: string; expiresAt: number } | null = null;

export class FeishuError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status = 400) {
    super(message);
    this.name = "FeishuError";
    this.code = code;
    this.status = status;
  }
}

interface FeishuResponse {
  code: number;
  msg?: string;
  data?: {
    content?: unknown;
    node?: { obj_token?: string; obj_type?: string };
    document?: { title?: unknown };
  };
  tenant_access_token?: string;
  expire?: number;
}

/** docs/v1/content 等云文档接口的错误码 → 中文提示 */
const DOCX_ERROR_MESSAGES: Record<number, string> = {
  2889901: "文档资源已过期，请重新打开文档后复制链接",
  2889902: "无权限读取该文档：请在文档右上角「… → …更多 → 添加文档应用」中授权本应用，并确认应用版本已发布",
  2889904: "链接参数无效，请检查是否复制完整",
  2889905: "飞书服务内部错误，请稍后重试",
  2889906: "文档已被删除",
  2889914: "文档 token 不存在或链接无效",
  2889925: "文档内容超过 10MB，无法导入",
  2889980: "文档正在复制/移动中，请稍后重试",
};

function errorMessage(data: FeishuResponse | null, fallback: string): string {
  if (!data) return fallback;
  // 应用未开通所需权限（飞书返回 99991672 或消息含"尚未开通 / scopes is required"）
  const msg = typeof data.msg === "string" ? data.msg : "";
  if (
    data.code === 99991672 ||
    (msg.includes("docs:document.content:read") && /尚未开通|scopes? is required/i.test(msg))
  ) {
    const applyLink = FEISHU_APP_ID
      ? `https://open.feishu.cn/app/${FEISHU_APP_ID}/auth?q=docs:document.content:read&op_from=openapi&token_type=tenant`
      : "开发者后台 → 权限管理";
    return `应用尚未开通「查看文档内容（docs:document.content:read）」权限，请到飞书开放平台开通并发布版本后重试：${applyLink}`;
  }
  return DOCX_ERROR_MESSAGES[data.code] || (typeof data.msg === "string" ? data.msg : fallback);
}

async function getTenantAccessToken(): Promise<string> {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new FeishuError(0, "未配置 FEISHU_APP_ID / FEISHU_APP_SECRET（见 .env.example）");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${FEISHU_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const data = (await res.json().catch(() => null)) as FeishuResponse | null;
  if (!data || data.code !== 0 || typeof data.tenant_access_token !== "string") {
    throw new FeishuError(data?.code ?? 0, errorMessage(data, "获取飞书 tenant_access_token 失败，请检查 App ID / App Secret"));
  }
  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (Number(data.expire) || 7200) * 1000,
  };
  return cachedToken.token;
}

async function apiGet(path: string, params: Record<string, string>): Promise<FeishuResponse> {
  const token = await getTenantAccessToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FEISHU_BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => null)) as FeishuResponse | null;
  if (!data || typeof data.code !== "number") {
    throw new FeishuError(0, `飞书接口异常（HTTP ${res.status}）`);
  }
  if (data.code !== 0) {
    throw new FeishuError(data.code, errorMessage(data, data.msg || "飞书接口错误"), res.status);
  }
  return data;
}

type ParsedFeishuUrl =
  | { kind: "docx"; token: string }
  | { kind: "doc"; token: string }
  | { kind: "wiki"; token: string }
  | { kind: "raw"; token: string };

/** 解析飞书分享链接：支持 /docx/、/docs/（旧版）、/wiki/（知识库）与裸 token */
export function parseFeishuUrl(input: string): ParsedFeishuUrl {
  const value = input.trim();
  if (TOKEN_RE.test(value)) return { kind: "raw", token: value };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FeishuError(0, "链接格式无效，请粘贴飞书文档分享链接");
  }
  if (url.protocol !== "https:") {
    throw new FeishuError(0, "仅支持 https 链接");
  }
  if (!ALLOWED_HOST_RE.test(url.hostname)) {
    throw new FeishuError(0, "仅支持飞书文档链接（feishu.cn / larksuite.com）");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "docx" || s === "docs" || s === "wiki");
  if (idx === -1 || !segments[idx + 1]) {
    throw new FeishuError(0, "无法识别链接中的文档 token，请检查是否复制完整");
  }
  const kind = segments[idx] as "docx" | "docs" | "wiki";
  const token = segments[idx + 1];
  if (!TOKEN_RE.test(token)) {
    throw new FeishuError(0, "链接中的文档 token 格式不正确");
  }
  if (kind === "docs") return { kind: "doc", token };
  if (kind === "wiki") return { kind: "wiki", token };
  return { kind: "docx", token };
}

/** 知识库节点 → 底层对象 token（需 wiki:wiki:readonly 权限） */
async function resolveWikiNode(nodeToken: string): Promise<{ token: string; objType: string }> {
  const data = await apiGet("/open-apis/wiki/v2/spaces/get_node", { token: nodeToken });
  const node = data?.data?.node;
  if (!node?.obj_token) {
    throw new FeishuError(0, "无法解析知识库节点");
  }
  return { token: node.obj_token, objType: node.obj_type || "docx" };
}

export interface FeishuDoc {
  title?: string;
  content: string;
}

/**
 * 拉取飞书文档的 Markdown 内容：
 * - /docs/ 旧版文档不支持，直接报错提示升级
 * - /wiki/ 先解析知识库节点，仅支持底层为 docx 的节点
 * - 标题优先取文档元信息（需 docx:document:readonly，失败时降级取正文首个 H1）
 */
export async function fetchFeishuDoc(urlOrToken: string): Promise<FeishuDoc> {
  const parsed = parseFeishuUrl(urlOrToken);

  if (parsed.kind === "doc") {
    throw new FeishuError(0, "旧版文档（/docs/）不支持 Markdown 导出，请在飞书里升级为新版文档后重试");
  }

  let token = parsed.token;
  if (parsed.kind === "wiki") {
    const node = await resolveWikiNode(token);
    if (node.objType !== "docx") {
      throw new FeishuError(0, `知识库节点类型 ${node.objType} 暂不支持，仅支持新版文档（docx）`);
    }
    token = node.token;
  }

  const data = await apiGet("/open-apis/docs/v1/content", {
    doc_token: token,
    doc_type: "docx",
    content_type: "markdown",
  });
  const content = data?.data?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new FeishuError(data?.code ?? 0, "文档内容为空，无法导入");
  }

  let title: string | undefined;
  try {
    const meta = await apiGet(`/open-apis/docx/v1/documents/${token}`, {});
    const metaTitle = meta?.data?.document?.title;
    if (typeof metaTitle === "string" && metaTitle.trim()) title = metaTitle.trim();
  } catch {
    // 未开通 docx:document:readonly 时降级：取正文第一个 H1 作为标题
  }
  if (!title) {
    const match = content.match(/^#\s+(.+)$/m);
    if (match) title = match[1].trim();
  }

  // 飞书导出会把表格管道符转义成 \|，还原成标准 GFM 表格再入库
  return { title, content: normalizeFeishuTableRows(content) };
}
