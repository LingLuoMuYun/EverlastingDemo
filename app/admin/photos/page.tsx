import PhotoAdminClient from "../../../components/PhotoAdminClient";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "照片墙管理 | " + siteConfig.title,
};

export default function AdminPhotosPage() {
  return <PhotoAdminClient />;
}
