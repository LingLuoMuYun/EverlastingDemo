import MusicAdminClient from "../../../components/MusicAdminClient";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "音乐曲库管理 | " + siteConfig.title,
};

export default function AdminMusicPage() {
  return <MusicAdminClient />;
}
