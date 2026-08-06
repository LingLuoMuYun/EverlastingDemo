import ProjectsAdminClient from "../../../components/ProjectsAdminClient";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "项目管理 | " + siteConfig.title,
};

export default function AdminProjectsPage() {
  return <ProjectsAdminClient />;
}
