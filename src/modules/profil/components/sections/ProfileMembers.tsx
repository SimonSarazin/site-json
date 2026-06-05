import { useProfileEntity } from "../../hooks/useProfileEntity";
import { EntityMembers } from "../members/EntityMembers";
import type { ProfileMembersSection } from "../../schema";

interface ProfileMembersProps {
  section: ProfileMembersSection;
}

/**
 * Onglet "membres" d'une page de profil (org → membres, projet → contributeurs,
 * event → participants). Wrapper mince autour du cœur générique `<EntityMembers>` :
 * l'entité vient du contexte profil, actions inline activées.
 */
export default function ProfileMembers({ section }: ProfileMembersProps) {
  const { entity } = useProfileEntity();

  return (
    <EntityMembers
      entity={entity}
      title={section.title}
      showRole={section.showRole}
      showManagement={section.showManagement}
      showActions
    />
  );
}
