import type { SearchEntity } from "@/modules/search/schema";

interface ProfileRelatedProps {
  section: {
    type: "profile-related";
    title?: { fr?: string; en?: string };
    relationType?: "parent" | "children" | "projects" | "events";
    limit?: number;
  };
  entity: SearchEntity;
  entityType: string;
}

export default function ProfileRelated({ section, entity, entityType }: ProfileRelatedProps) {
  // À implémenter selon vos besoins
  return null;
}
