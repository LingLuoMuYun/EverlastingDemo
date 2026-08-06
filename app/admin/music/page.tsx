import MusicAdminClient from "../../../components/MusicAdminClient";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "音乐曲库管理 | " + siteConfig.title,
};

export default function AdminMusicPage() {
  return <MusicAdminClient />;
}
