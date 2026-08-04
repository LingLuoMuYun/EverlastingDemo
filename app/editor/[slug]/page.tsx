import { notFound } from "next/navigation";
import Navbar from "../../../components/Navbar";
import PageTransition from "../../../components/PageTransition";
import EditorClient from "../../../components/EditorClient";
import EditorReadonly from "../../../components/EditorReadonly";
import { ToastProvider } from "../../../components/ToastProvider";
import { getAllNotesMeta, getNote, getNoteMtime } from "../../../lib/notes";
import { siteConfig } from "../../../siteConfig";

export const metadata = {
  title: "编辑笔记 | " + siteConfig.title,
};

export default async function EditNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (process.env.NODE_ENV === "production") return <EditorReadonly />;

  const note = getNote(slug, { includeDraft: true });
  if (!note) notFound();
  const initialMtime = getNoteMtime(slug);
  const allSlugs = getAllNotesMeta({ includeDraft: true }).map((n) => n.slug);

  return (
    <ToastProvider>
      <div className="min-h-screen relative pb-16">
        <Navbar />
        <PageTransition>
          <EditorClient mode="edit" note={note} initialMtime={initialMtime} allSlugs={allSlugs} />
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
