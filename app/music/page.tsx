import { getSiteConfig } from "@/lib/site";
import MusicClient from "./MusicClient";

const siteConfig = getSiteConfig();

// 🌟 这里是服务端渲染，完美支持 metadata
export const metadata = {
  title: "音乐馆 | " + siteConfig.title,
};

export default function MusicPage() {
  return <MusicClient />;
}
