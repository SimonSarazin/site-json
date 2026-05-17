/**
 * Picker multi-select de membres d'une entité Cocolight (Project / Organization / Event).
 *
 * Wrap `SelectObject` (UI générique multi-select + recherche async + thumbs) avec un
 * `onSearch` qui dispatche selon le type de l'entité :
 *
 *  - `Project` → `entity.getContributors({ search }, options)`
 *  - `Organization` → `entity.getMembers({ search }, options)`
 *  - `Event` → `entity.getAttendees({ search }, options)`
 *
 * Le `value` exposé enrichit chaque sélection avec `{ id, type, name, username? }`. Le
 * champ `username` n'est présent que pour les Users (citoyens) — utile pour les payloads
 * SDK qui acceptent `mentions: string[]` (ex. `costumProjectActionRequestNew`), où le
 * backend résout `username` → `links.contributors.{userId}`.
 *
 * @remarks
 * Contrairement à `searchMembers` (qui filtre brutalement la réponse et supprime
 * `username` côté SDK), les endpoints `getContributors / getMembers / getAttendees`
 * retournent les objets bruts avec `serverData.username` accessible.
 */

import { useCallback } from "react";
import type { EntityTypes, User, Organization } from "@communecter/cocolight-api-client";
import { SelectObject } from "@/components/ui/select-objet";
import { isOrganization, isProject, isEvent } from "@/lib/getTypedEntity";

/**
 * Valeur exposée au caller : objet enrichi de chaque membre sélectionné.
 *
 * - `id` : MongoId, clé primaire (toujours présent).
 * - `type` : `"citoyens"` (User) | `"organizations"` (Organization).
 * - `name` : libellé affichable.
 * - `username` : slug user — uniquement pour les `type === "citoyens"`. Utilisé par les
 *   payloads `mentions: string[]` côté SDK Cocolight.
 */
export interface SelectMemberValue {
  id: string;
  type: "citoyens" | "organizations" | string;
  name: string;
  username?: string;
}

interface SelectMemberProps {
  /** Entité parent (Project / Organization / Event). Si `null`, le picker reste désactivé. */
  entity: EntityTypes | null;
  /** Valeur courante. Tableau si `multiple`, single sinon. */
  value: SelectMemberValue | SelectMemberValue[] | null;
  /** Callback notifié à chaque sélection / désélection. */
  onChange: (value: SelectMemberValue | SelectMemberValue[] | null) => void;
  /** Mode multi-select (default `false`). */
  multiple?: boolean;
  /** Placeholder du bouton fermé. */
  placeholder?: string;
  /** Placeholder du champ de recherche ouvert. */
  searchPlaceholder?: string;
  /** Désactive l'interaction. */
  disabled?: boolean;
  /** Délai du debounce de recherche en ms (default 300). */
  delay?: number;
  /**
   * Filtre les résultats côté backend Cocolight (SDK 1.0.129+) :
   *  - `"citoyens"` : Users uniquement (typiquement pour les payloads `mentions`).
   *  - `"organizations"` : Organizations uniquement.
   *  - `"all"` ou omis : les deux (default SDK).
   *
   * Pour `Event.getAttendees`, ce filtre est ignoré (l'endpoint retourne uniquement des Users).
   */
  searchType?: "all" | "citoyens" | "organizations";
}

type SelectOption = {
  id: string;
  label: string;
  value: SelectMemberValue;
  thumb?: string;
};

function getEntityMemberType(member: User | Organization): "citoyens" | "organizations" {
  const t = member.getEntityType?.();
  return t === "organizations" ? "organizations" : "citoyens";
}

function mapMemberToOption(member: User | Organization): SelectOption | null {
  const id = member.id;
  if (!id) return null;
  const sd = (member.serverData ?? {}) as {
    name?: string;
    username?: string;
    profilThumbImageUrl?: string;
  };
  const type = getEntityMemberType(member);
  const name = sd.name ?? id;
  return {
    id,
    label: name,
    value: {
      id,
      type,
      name,
      username: type === "citoyens" ? sd.username : undefined,
    },
    thumb: sd.profilThumbImageUrl,
  };
}

async function fetchMembersByEntityType(
  entity: EntityTypes,
  search: string,
  searchType?: "all" | "citoyens" | "organizations",
): Promise<(User | Organization)[]> {
  // Le SDK Cocolight attend `name` (terme recherché) et `indexStep` (taille de page).
  // Cf. `useInfiniteEntityQuery` qui construit le même shape pour `getContributors / getMembers / getAttendees`.
  const data = { name: search, indexStep: 20 };
  if (isProject(entity)) {
    const page = await entity.getContributors(data, searchType ? { searchType } : {});
    return page.results ?? [];
  }
  if (isOrganization(entity)) {
    const page = await entity.getMembers(data, searchType ? { searchType } : {});
    return page.results ?? [];
  }
  if (isEvent(entity)) {
    // Event.getAttendees ne supporte pas `searchType` (retourne uniquement des Users).
    const page = await entity.getAttendees(data, {});
    return page.results ?? [];
  }
  return [];
}

export function SelectMember({
  entity,
  value,
  onChange,
  multiple = false,
  placeholder,
  searchPlaceholder,
  disabled = false,
  delay = 300,
  searchType,
}: SelectMemberProps) {
  const onSearch = useCallback(
    async (query: string): Promise<SelectOption[]> => {
      if (!entity || disabled) return [];
      try {
        const members = await fetchMembersByEntityType(entity, query, searchType);
        return members
          .map(mapMemberToOption)
          .filter((opt): opt is SelectOption => opt !== null);
      } catch (err) {
        console.error("[SelectMember] search error:", err);
        return [];
      }
    },
    [entity, disabled, searchType],
  );

  return (
    <SelectObject
      value={value}
      onChange={(next) => onChange(next as SelectMemberValue | SelectMemberValue[] | null)}
      onSearch={onSearch}
      multiple={multiple}
      placeholder={placeholder}
      placeholderSearch={searchPlaceholder}
      delay={delay}
    />
  );
}
