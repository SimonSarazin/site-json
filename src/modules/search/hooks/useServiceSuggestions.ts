import { useMemo, useState } from "react";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { findSectionByRef } from "@/lib/sectionContainers";
import { buildServiceSuggestions, resourceDisplayName } from "../lib/resourceDirectorySearch";
import { useResourceDirectoryItems, type ResourceDirectorySource } from "./useResourceDirectoryItems";

/** Source vide : les hooks sont appelés sans condition, `enabled: false` empêche tout appel. */
const AUCUNE_SOURCE: ResourceDirectorySource = { resourceTypes: [], finderSuffix: "" };

/**
 * Suggestions de SERVICES pour une saisie, tirées de l'annuaire désigné par `ref` (page + id de sa
 * section `coform-resource-directory` : sa config est reprise, rien n'est recopié). Les services ne
 * sont chargés qu'à la première saisie d'au moins 2 caractères. `ref` absent ou ne désignant pas un
 * annuaire → aucune suggestion, aucun appel. Chaque suggestion porte le lien qui ouvre son détail
 * dans l'annuaire (`?resource=`, paramètre de détail de la section).
 */
export function useServiceSuggestions(ref: { page: string; sectionId: string } | undefined, query: string) {
  const { config } = useSite();
  const t = useT("modules/search");

  const source = useMemo(() => {
    const section = ref ? findSectionByRef(config?.pages, ref) : null;
    return section?.type === "coform-resource-directory" ? (section.props as unknown as ResourceDirectorySource) : null;
  }, [config?.pages, ref]);

  // Chargement différé à la première vraie saisie, puis gardé (le cache de la requête est partagé
  // avec l'annuaire lui-même).
  const [demarre, setDemarre] = useState(false);
  if (!demarre && source && query.trim().length >= 2) setDemarre(true);

  const { items, parents, isPending } = useResourceDirectoryItems(source ?? AUCUNE_SOURCE, {
    enabled: !!source && demarre,
  });

  const suggestions = useMemo(() => {
    if (!source || !ref) return [];
    const ressources = items.map((it) => {
      const parentId = it.model.parent?.id;
      const parent = parentId ? parents.get(parentId) : undefined;
      const parentName = parent?.name ?? it.model.parent?.name;
      return {
        id: it.id,
        name: resourceDisplayName(it.model, t, parentName),
        parentName,
        locality: parent?.addressLocality,
        postalCode: parent?.postalCode,
      };
    });
    return buildServiceSuggestions(ressources, query).map((s) => ({
      ...s,
      href: `${ref.page}?resource=${encodeURIComponent(s.id)}`,
    }));
  }, [source, ref, items, parents, query, t]);

  return { enabled: !!source, suggestions, isLoading: !!source && demarre && isPending };
}
