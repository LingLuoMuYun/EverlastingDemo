import { getSiteConfig } from "@/lib/site";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import ToolboxClient from "./ToolboxClient";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "工具箱 | " + siteConfig.title,
  description: "TodoList、番茄钟与专注统计",
};

export default function ToolboxPage() {
  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <ToolboxClient />
      </PageTransition>
    </div>
  );
}
