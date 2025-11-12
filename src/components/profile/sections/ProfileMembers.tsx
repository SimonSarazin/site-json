import type { SearchEntity } from "@/modules/search/schema";

interface ProfileMembersProps {
  section: {
    type: "profile-members";
    title?: { fr?: string; en?: string };
    limit?: number;
    showRole?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileMembers({ section: _section, entity: _entity }: ProfileMembersProps) {
  // À implémenter selon vos besoins
  return null;
}
