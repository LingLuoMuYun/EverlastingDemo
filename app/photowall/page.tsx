import { siteConfig } from "../../siteConfig";
import PhotoWallClient from "./PhotoWallClient";
import { toPublicPhotoLibrary } from "../../lib/photos";

export const metadata = {
  title: "照片墙 | " + siteConfig.title,
};

export default function PhotoWallPage() {
  const library = toPublicPhotoLibrary();
  return <PhotoWallClient albums={library.albums} />;
}
