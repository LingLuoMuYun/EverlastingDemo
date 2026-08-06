import PageTransition from "../../../../components/PageTransition";
import EditorClient from "../../../../components/EditorClient";
import { ToastProvider } from "../../../../components/ToastProvider";
import { getAllNotesMeta } from "../../../../lib/notes";
import { getSiteConfig } from "../../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "新建笔记 | " + siteConfig.title,
};

export default function AdminNewNotePage() {
  const allSlugs = getAllNotesMeta({ includeDraft: true }).map((n) => n.slug);
  const autoPush = process.env.AUTO_PUSH !== "0";
  return (
    <ToastProvider>
      <PageTransition>
        <EditorClient mode="edit" note={null} allSlugs={allSlugs} autoPush={autoPush} embedded />
      </PageTransition>
    </ToastProvider>
  );
}
