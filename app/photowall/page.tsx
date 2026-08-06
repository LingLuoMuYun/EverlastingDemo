import { getSiteConfig } from "../../lib/site";
import PhotoWallClient from "./PhotoWallClient";
import { toPublicPhotoLibrary } from "../../lib/photos";

const siteConfig = getSiteConfig();

export const metadata = {
  title: "照片墙 | " + siteConfig.title,
};

export default function PhotoWallPage() {
  const library = toPublicPhotoLibrary();
  return <PhotoWallClient albums={library.albums} />;
}
