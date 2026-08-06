import FriendsAdminClient from "../../../components/FriendsAdminClient";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "友链管理 | " + siteConfig.title,
};

export default function AdminFriendsPage() {
  return <FriendsAdminClient />;
}
