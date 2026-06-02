import { lazy } from "vite-preload";
import { useInteropUserLinks } from "./hooks/useUserInteropLinks";

const MediawikiPod = lazy(() => import("./components/MediawikiPod"));
const MediawikiLink = lazy(() => import("./components/MediawikiLink"));

const MediawikiSection = () => {
  const { isWikiLinked, isOwnProfile } = useInteropUserLinks();

  if (!isWikiLinked && !isOwnProfile) return null;

  return (
    <>
      {isWikiLinked ? <MediawikiPod /> : <MediawikiLink />}
    </>
  );
};

export default MediawikiSection;
