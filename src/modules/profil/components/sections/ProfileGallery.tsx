interface ProfileGalleryProps {
  section: {
    type: "profile-gallery";
    title?: { fr?: string; en?: string };
    columns?: number;
    lightbox?: boolean;
  };
}

export default function ProfileGallery({ section: _section }: ProfileGalleryProps) {
  // TODO
  // Si besoin d'entity: const { entity } = useProfileEntity();
  return null;
}
