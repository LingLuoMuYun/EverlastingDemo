import SiteSettingsClient from "../../../components/SiteSettingsClient";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "站点配置 | " + siteConfig.title,
};

export default function AdminSettingsPage() {
  return <SiteSettingsClient />;
}
