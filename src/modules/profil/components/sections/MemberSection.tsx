import { useSectionEntity } from "@/hooks/useSectionEntity";
import { EntityMembers } from "../members/EntityMembers";
import type { MemberSectionProps } from "../../schema";

interface MemberSectionComponentProps {
  id?: string;
  props: MemberSectionProps;
}

/**
 * Section JSON-driven `member` : affiche les membres/contributeurs/participants
 * d'une entité. L'entité est résolue par `useSectionEntity` (slug → fetch ;
 * sinon entité du contexte). Rendu délégué au cœur générique `<EntityMembers>`
 * (mutualisé avec l'onglet de profil `<ProfileMembers>`). Lecture seule (pas
 * d'actions inline) ; les boutons inviter/gérer restent gated par les permissions.
 */
export default function MemberSection({ id, props }: MemberSectionComponentProps) {
  const { entity } = useSectionEntity({ slug: props.slug });

  return (
    <div id={id}>
      <EntityMembers
        entity={entity}
        title={props.title}
        showRole={props.showRole}
        showManagement={props.showManagement}
        showCard={props.showCard}
        search={props.search}
        card={props.card}
      />
    </div>
  );
}
