import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 不要开启 output: 'export'，API Routes 需要 Serverless 运行
  images: {
    unoptimized: true, // 全站原生 <img> + 外部图床，禁用 Next 图片优化
  },
  // 类型错误已在构建期拦截（勿改回 true，否则会掩盖真实类型问题）
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
