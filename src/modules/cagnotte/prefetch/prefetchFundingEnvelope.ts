/**
 * Prefetch SSR pour la query `useFundingEnvelope`.
 *
 * Stocke dans le cache React Query la donnée normalisée correspondant à la
 * `FUNDING_ENVELOPE` queryKey, de sorte que côté client, le composant qui
 * appelle `useFundingEnvelope(projectId)` trouve la donnée immédiatement
 * (pas de loading visible sur les sections `finance` / `actions` / `*-summary`).
 *
 * Usage typique (loader SSR / entry-server) :
 *
 *   await prefetchFundingEnvelope(queryClient, {
 *     entity,
 *     entityId: entity.id,
 *     contextType: 'projects',     // ou 'organizations', 'citoyens'
 *     projectId,
 *     profileSlug: params.slug,    // slug du profil dans l'URL /profil/:slug
 *     me,
 *   });
 *
 * Échec silencieux : si l'entité ne supporte pas `fundingEnvelope()` ou que
 * l'appel échoue, la fonction renvoie sans rien stocker — le composant client
 * fera son fetch normalement (graceful degradation).
 */
import type { QueryClient } from "@tanstack/react-query";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { CAGNOTTE_QUERY_KEYS } from "../constants/queryKeys";
import {
  extractFormIdFromEnvelope,
  mergeEnvelopePayloads,
  normalizeFundingEnvelope,
  type FundingEnvelopeNormalizedData,
} from "../hooks/useFundingEnvelope";

type UnknownRecord = Record<string, unknown>;

export interface PrefetchFundingEnvelopeParams {
  /** Entité courante (Project / Organization / User) — doit exposer `fundingEnvelope()` */
  entity: EntityTypes | null | undefined;
  /** ID de contexte (override). Si absent, `entity.id` est utilisé. */
  entityId?: string;
  /** Type de contexte normalisé (`projects` | `organizations` | `citoyens`). */
  contextType?: string;
  /** ID du projet à pré-charger (peut rester vide). */
  projectId?: string;
  /** Slug profil — utilisé pour résoudre `selectedProject` sans dépendre de `window`. */
  profileSlug?: string;
  /** Utilisateur connecté (sert au `getFormData`). */
  me?: User | null;
}

function normalizeEntityType(type: string | undefined | null): string {
  const lowered = (type || "").toLowerCase();
  if (lowered.includes("organization")) return "organizations";
  if (lowered.includes("project")) return "projects";
  if (lowered.includes("citoyen") || lowered.includes("user")) return "citoyens";
  return lowered;
}

/**
 * Pré-charge la `fundingEnvelope` normalisée dans le cache React Query.
 */
export async function prefetchFundingEnvelope(
  queryClient: QueryClient,
  params: PrefetchFundingEnvelopeParams
): Promise<void> {
  const { entity, me } = params;
  if (!entity) return;

  const entityRecord = entity as unknown as UnknownRecord;
  if (typeof entityRecord.fundingEnvelope !== "function") return;

  const entityId = (params.entityId || entity.id || "").toString();
  const contextType = normalizeEntityType(
    params.contextType ||
      (typeof entity.getEntityType === "function" ? entity.getEntityType() : undefined)
  );
  const projectId = params.projectId ?? "";
  const profileSlug = params.profileSlug ?? "";

  if (!entityId || !contextType) return;

  const queryKey = CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE(
    entityId,
    contextType,
    projectId,
    profileSlug,
    me?.id ?? null
  );

  await queryClient.prefetchQuery<FundingEnvelopeNormalizedData>({
    queryKey,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const fundingEnvelope = entityRecord.fundingEnvelope as (
        payload: UnknownRecord
      ) => Promise<unknown>;

      try {
        const rawEnvelope = await fundingEnvelope.call(entity, {
          contextId: entityId,
          contextType,
          action: "getEnvelopeData",
        });

        let merged: unknown = rawEnvelope;
        const formId = extractFormIdFromEnvelope(rawEnvelope);
        // Skip getFormData si pas de financerId (backend PHP n'a pas isset-protégé
        // $_POST['financerId'] → erreur "Undefined index"). Côté SSR `me` est
        // toujours null donc l'appel ne se déclenche jamais ici.
        if (formId && me?.id) {
          try {
            const rawFormData = await fundingEnvelope.call(entity, {
              contextId: entityId,
              contextType,
              formId,
              financerId: me.id,
              financerType: "citoyens",
              action: "getFormData",
              params: { project: "all" },
            });
            merged = mergeEnvelopePayloads(rawEnvelope, rawFormData);
          } catch (formError) {
            console.warn(
              "[prefetchFundingEnvelope] getFormData indisponible, fallback getEnvelopeData",
              formError
            );
          }
        }

        return normalizeFundingEnvelope(merged, entityId, contextType, projectId, profileSlug);
      } catch (error) {
        console.error("[prefetchFundingEnvelope] Erreur fundingEnvelope:", error);
        throw error;
      }
    },
  });
}
