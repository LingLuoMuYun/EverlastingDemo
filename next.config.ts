import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 不要开启 output: 'export'，API Routes 需要 Serverless 运行
  images: {
    unoptimized: true, // 全站原生 <img> + 外部图床，禁用 Next 图片优化
  },
  typescript: {
    ignoreBuildErrors: true, // 参考项目如此；生产环境建议改为 false
  },
};

export default nextConfig;
