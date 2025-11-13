interface ProfileRelatedProps {
  section: {
    type: "profile-related";
    title?: { fr?: string; en?: string };
    relationType?: "parent" | "children" | "projects" | "events";
    limit?: number;
  };
}

export default function ProfileRelated({ section: _section }: ProfileRelatedProps) {
  // À implémenter selon vos besoins
  // Si besoin: const { entity, entityType } = useProfileEntity();
  return null;
}
