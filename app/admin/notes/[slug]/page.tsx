import { notFound } from "next/navigation";
import PageTransition from "../../../../components/PageTransition";
import EditorClient from "../../../../components/EditorClient";
import { ToastProvider } from "../../../../components/ToastProvider";
import { getAllNotesMeta, getNote, getNoteMtime } from "../../../../lib/notes";
import { getSiteConfig } from "../../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "编辑笔记 | " + siteConfig.title,
};

export default async function AdminEditNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNote(slug, { includeDraft: true });
  if (!note) notFound();
  const initialMtime = getNoteMtime(slug);
  const allSlugs = getAllNotesMeta({ includeDraft: true }).map((n) => n.slug);
  const autoPush = process.env.AUTO_PUSH !== "0";

  return (
    <ToastProvider>
      <PageTransition>
        <EditorClient mode="edit" note={note} initialMtime={initialMtime} allSlugs={allSlugs} autoPush={autoPush} embedded />
      </PageTransition>
    </ToastProvider>
  );
}
