import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ProjectsBoard from './ProjectsBoard';
import { siteConfig } from "@/siteConfig";
import { getPublicProjects } from "../../lib/projects";

export const metadata = {
  title: "项目矩阵 | " + siteConfig.title,
  description: "开源项目与代码仓库展示",
};

export default function ProjectsPage() {
  const projects = getPublicProjects();
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28">
          <ProjectsBoard projects={projects} />
        </div>
      </PageTransition>
    </div>
  );
}
