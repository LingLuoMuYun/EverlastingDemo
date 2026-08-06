import PageTransition from "../../../components/PageTransition";
import EditorClient from "../../../components/EditorClient";
import { ToastProvider } from "../../../components/ToastProvider";
import { getAllNotesMeta } from "../../../lib/notes";
import { getSiteConfig } from "../../../lib/site";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "笔记管理 | " + siteConfig.title,
};

export default function AdminNotesPage() {
  const notes = getAllNotesMeta({ includeDraft: true });
  const autoPush = process.env.AUTO_PUSH !== "0";
  return (
    <ToastProvider>
      <PageTransition>
        <EditorClient mode="list" notes={notes} autoPush={autoPush} embedded />
      </PageTransition>
    </ToastProvider>
  );
}
