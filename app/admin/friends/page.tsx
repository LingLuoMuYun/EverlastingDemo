import FriendsAdminClient from "../../../components/FriendsAdminClient";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "友链管理 | " + siteConfig.title,
};

export default function AdminFriendsPage() {
  return <FriendsAdminClient />;
}
