// lib/site-schema.ts —— 站点配置字段 schema（纯数据，服务端校验与后台表单共用）
// 最小可用版：仅开放高频字段；footerBadges / icpConfig / buildDate 等低频复杂字段留在 siteConfig.ts 代码中

export type SiteFieldType = "text" | "textarea" | "url" | "color" | "switch" | "list";
export type SiteListItemType = "text" | "url-or-path" | "color";

export interface SiteField {
  /** 点路径，如 social.github */
  key: string;
  label: string;
  type: SiteFieldType;
  required?: boolean;
  max?: number;
  placeholder?: string;
  help?: string;
  /** list 类型：列表项类型 */
  itemType?: SiteListItemType;
  minItems?: number;
  maxItems?: number;
}

export interface SiteFieldGroup {
  key: string;
  title: string;
  fields: SiteField[];
}

export const SITE_FIELD_GROUPS: SiteFieldGroup[] = [
  {
    key: "basic",
    title: "基本信息",
    fields: [
      {
        key: "title",
        label: "站点标题",
        type: "text",
        required: true,
        max: 60,
        placeholder: "浏览器标签 / SEO 标题",
      },
      { key: "authorName", label: "作者名", type: "text", required: true, max: 30 },
      { key: "bio", label: "签名", type: "textarea", max: 200 },
      { key: "avatarUrl", label: "头像地址", type: "url", help: "支持 http(s) 或本地 /path" },
      { key: "faviconUrl", label: "站点图标", type: "url", help: "支持 http(s) 或本地 /path" },
    ],
  },
  {
    key: "nav",
    title: "导航",
    fields: [
      { key: "navTitle", label: "导航标题", type: "text", max: 20 },
      { key: "navSuffix", label: "分隔符", type: "text", max: 10 },
      { key: "navAfter", label: "导航后缀", type: "text", max: 20 },
    ],
  },
  {
    key: "appearance",
    title: "外观",
    fields: [
      {
        key: "useGradient",
        label: "渐变背景",
        type: "switch",
        help: "开 = 流动渐变背景，关 = 图片背景",
      },
      {
        key: "themeColors",
        label: "渐变主题色",
        type: "list",
        itemType: "color",
        minItems: 1,
        maxItems: 8,
        help: "至少 1 个色值",
      },
      {
        key: "bgImages",
        label: "背景图片",
        type: "list",
        itemType: "url-or-path",
        maxItems: 8,
        help: "useGradient 关闭时生效",
      },
    ],
  },
  {
    key: "social",
    title: "社交",
    fields: [
      { key: "social.github", label: "GitHub", type: "url" },
      { key: "social.email", label: "邮箱", type: "text", max: 80 },
      { key: "social.qq", label: "QQ", type: "text", max: 20 },
    ],
  },
  {
    key: "talk",
    title: "杂谈",
    fields: [
      { key: "chatterTitle", label: "杂谈标题", type: "text", max: 30 },
      { key: "chatterDescription", label: "杂谈描述", type: "textarea", max: 100 },
    ],
  },
];

/** 可编辑字段白名单（点路径），服务端保存与校验共用 */
export const SITE_EDITABLE_KEYS: string[] = SITE_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

export function findSiteField(key: string): SiteField | undefined {
  for (const group of SITE_FIELD_GROUPS) {
    const field = group.fields.find((f) => f.key === key);
    if (field) return field;
  }
  return undefined;
}
