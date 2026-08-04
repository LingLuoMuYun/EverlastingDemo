import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import NoteBoard from "../../components/NoteBoard";
import { getAllNotesMeta } from "../../lib/notes";
import { siteConfig } from "../../siteConfig";

export const metadata = {
  title: "杂谈 | " + siteConfig.title,
  description: siteConfig.chatterDescription || "日常碎片与灵感记录",
};

export default function NotesPage() {
  const notes = getAllNotesMeta();
  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <NoteBoard notes={notes} />
      </PageTransition>
    </div>
  );
}
