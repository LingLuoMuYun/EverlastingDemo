import { getSiteConfig } from "@/lib/site";
import Navbar from "../../../components/Navbar";
import PageTransition from "../../../components/PageTransition";
import TodosClient from "./TodosClient";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "TodoList | " + siteConfig.title,
  description: "待办清单：优先级、标签、截止日期与进度追踪",
};

export default function TodosPage() {
  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <TodosClient />
      </PageTransition>
    </div>
  );
}
