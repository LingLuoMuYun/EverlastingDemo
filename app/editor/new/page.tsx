import Navbar from "../../../components/Navbar";
import PageTransition from "../../../components/PageTransition";
import EditorClient from "../../../components/EditorClient";
import EditorReadonly from "../../../components/EditorReadonly";
import { ToastProvider } from "../../../components/ToastProvider";
import { getAllNotesMeta } from "../../../lib/notes";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "新建笔记 | " + siteConfig.title,
};

export default function NewNotePage() {
  if (process.env.NODE_ENV === "production") return <EditorReadonly />;
  const allSlugs = getAllNotesMeta({ includeDraft: true }).map((n) => n.slug);
  return (
    <ToastProvider>
      <div className="min-h-screen relative pb-16">
        <Navbar />
        <PageTransition>
          <EditorClient mode="edit" note={null} allSlugs={allSlugs} />
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
