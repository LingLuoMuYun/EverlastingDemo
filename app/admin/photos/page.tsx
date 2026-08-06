import PhotoAdminClient from "../../../components/PhotoAdminClient";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "照片墙管理 | " + siteConfig.title,
};

export default function AdminPhotosPage() {
  return <PhotoAdminClient />;
}
