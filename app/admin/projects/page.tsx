import ProjectsAdminClient from "../../../components/ProjectsAdminClient";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "项目管理 | " + siteConfig.title,
};

export default function AdminProjectsPage() {
  return <ProjectsAdminClient />;
}
