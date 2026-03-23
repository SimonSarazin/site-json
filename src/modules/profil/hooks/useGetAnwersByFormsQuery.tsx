import { useQuery } from "@tanstack/react-query";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { QUERY_KEYS } from "../constants/queryKeys";
import type { ProfileTiersLieuxInfoSection } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import BaseEntity from "node_modules/@communecter/cocolight-api-client/types/api/BaseEntity";

/**
 * Construit le paramètre `forms` attendu par `searchAnswersByForms`.
 *
 * Pour chaque entrée du schéma :
 *  - Si `linked: true` et que `finder` est défini  → valeur = `finder + "." + entityId`
 *  - Si `linked: true` sans `finder`               → valeur = formId (fallback)
 *  - Si `linked: false`                            → entrée ignorée
 */
function buildFormsParam(
  forms: NonNullable<ProfileTiersLieuxInfoSection["forms"]>,
  entityId: string
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(forms)
      .filter(([, cfg]) => cfg.linked)
      .map(([formId, cfg]) => [
        formId,
        cfg.finder ? `${cfg.finder}.${entityId}` : formId,
      ])
  );
}

interface UseGetAnswersByFormsQueryProps {
  entity: SearchEntity;
  forms: ProfileTiersLieuxInfoSection["forms"];
  enabled?: boolean;
}

/**
 * Hook pour récupérer la liste des réponses liées à une liste de formulaires.
 *
 * Utilise `entity.searchAnswersByForms()` du SDK cocolight.
 * Seuls les formulaires avec `linked: true` sont transmis à l'API.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useGetAnswersByFormsQuery({
 *   entity,
 *   forms: section.forms,
 * });
 * ```
 */
export function useGetAnswersByFormsQuery({
  entity,
  forms,
  enabled = true,
}: UseGetAnswersByFormsQueryProps) {
  const userContextId = useHydratedUserContextId();

  const entityId = entity?.id ?? null;
  // IDs des formulaires actifs (linked: true) — sert de clé de cache stable
  const linkedFormIds = forms
    ? Object.entries(forms)
        .filter(([, cfg]) => cfg.linked)
        .map(([id]) => id)
    : [];

  const hasLinkedForms = linkedFormIds.length > 0;

  return useQuery({
    queryKey: QUERY_KEYS.ANSWERS_BY_FORMS(entityId, linkedFormIds, userContextId),
    queryFn: async () => {
      if (!entity || !entityId || !forms) {
        throw new Error("Entité ou formulaires manquants.");
      }

      const formsParam = buildFormsParam(forms, entityId);

      try {
        const results = await (entity as BaseEntity).searchAnswersByForms({ forms: formsParam });
        return results;
      } catch (err) {
        console.error("[useGetAnswersByFormsQuery] Erreur searchAnswersByForms:", err);
        throw err;
      }
    },
    enabled: enabled && !!entity && !!entityId && hasLinkedForms,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
