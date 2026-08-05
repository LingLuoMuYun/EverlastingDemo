import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 本仓库由旧版 React 风格代码移植而来，多个组件有意使用 effect 内同步 setState
      // （hydration 挂载标记、打字机歌词动画、防抖、视口测量等），属有意为之的模式。
      // 待逐步重构为 useMemo / key 派生后再重新启用该规则。
      "react-hooks/set-state-in-effect": "off",
      // 全站 images.unoptimized=true（见 next.config.ts），图片统一用原生 <img> + 外链图床，
      // next/image 优化对本站无实际收益。
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
