import { getSiteConfig } from "@/lib/site";
import Navbar from "../../../components/Navbar";
import PageTransition from "../../../components/PageTransition";
import PomodoroClient from "./PomodoroClient";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "番茄钟 | " + siteConfig.title,
  description: "专注计时与今日统计",
};

export default function PomodoroPage() {
  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <PomodoroClient />
      </PageTransition>
    </div>
  );
}
