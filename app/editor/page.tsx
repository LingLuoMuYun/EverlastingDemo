import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import EditorClient from "../../components/EditorClient";
import EditorReadonly from "../../components/EditorReadonly";
import { ToastProvider } from "../../components/ToastProvider";
import { getAllNotesMeta } from "../../lib/notes";
import { siteConfig } from "../../siteConfig";

export const metadata = {
  title: "本地编辑器 | " + siteConfig.title,
};

export default function EditorPage() {
  if (process.env.NODE_ENV === "production") return <EditorReadonly />;
  const notes = getAllNotesMeta({ includeDraft: true });
  const autoPush = process.env.AUTO_PUSH !== "0";
  return (
    <ToastProvider>
      <div className="min-h-screen relative pb-16">
        <Navbar />
        <PageTransition>
          <EditorClient mode="list" notes={notes} autoPush={autoPush} />
        </PageTransition>
      </div>
    </ToastProvider>
  );
}
