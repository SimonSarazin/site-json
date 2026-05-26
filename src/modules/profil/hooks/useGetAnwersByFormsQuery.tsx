import { useQuery } from "@tanstack/react-query";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import type { ProfileTiersLieuxInfoSection } from "../schema";
import type { SearchEntity, Answer } from "@communecter/cocolight-api-client";

/**
 * Shape retournée par `entity.searchAnswersByForms()` (typage local).
 *
 * La signature lib `BaseEntity.searchAnswersByForms` (BaseEntity.d.ts:1700) retourne
 * `Promise<{ answers: Answer[]; documents: any[]; [k: string]: unknown }[]>` — le champ
 * `id` (présent en runtime côté backend costum, identifie le formulaire) n'est exposé
 * que via le `[k]: unknown`. Le type local le rend explicite pour les call-sites qui font
 * `result.find(r => r.id === formId)`.
 */
interface AnswersByFormsResult {
  id: string;
  answers: Answer[];
  documents?: unknown[];
  [key: string]: unknown;
}


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
    queryKey: PROFIL_QUERY_KEYS.ANSWERS_BY_FORMS(entityId, linkedFormIds, userContextId),
    queryFn: async () => {
      if (!entity || !entityId || !forms) {
        throw new Error("Entité ou formulaires manquants.");
      }

      const formsParam = buildFormsParam(forms, entityId);

      try {
        // Façade `BaseEntity.searchAnswersByForms` (BaseEntity.d.ts:1700) — retour typé
        // `{ answers: Answer[]; documents: any[]; [k]: unknown }[]` côté lib. On l'élargit
        // localement à `AnswersByFormsResult[]` (qui rend `id` explicite — toujours présent
        // en runtime côté backend costum).
        const results = await entity.searchAnswersByForms({ forms: formsParam });
        return results as AnswersByFormsResult[];
      } catch (err) {
        console.error("[useGetAnswersByFormsQuery] Erreur searchAnswersByForms:", err);
        throw err;
      }
    },
    enabled: enabled && !!entity && !!entityId && hasLinkedForms,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
