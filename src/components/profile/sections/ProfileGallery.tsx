import type { SearchEntity } from "@/modules/search/schema";

interface ProfileGalleryProps {
  section: {
    type: "profile-gallery";
    title?: { fr?: string; en?: string };
    columns?: number;
    lightbox?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileGallery({ section: _section, entity: _entity }: ProfileGalleryProps) {
  // TODO
  return null;
}
