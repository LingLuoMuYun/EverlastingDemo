import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import NoteBoard from "../../components/NoteBoard";
import { getAllNotesMeta } from "../../lib/notes";
import { getSiteConfig } from "../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "杂谈 | " + siteConfig.title,
  description: siteConfig.chatterDescription || "日常碎片与灵感记录",
};

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const notes = getAllNotesMeta();
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <NoteBoard notes={notes} initialKind={kind} />
      </PageTransition>
    </div>
  );
}
