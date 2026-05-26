/**
 * Mutations interop (Discourse + MediaWiki) — factory + hooks.
 *
 * Pattern aligné avec `profil/actions/mutations/core.ts` et `cagnotte/actions/mutations/` :
 * la factory encapsule `useMutationWithToast` + le `refreshMe()` post-succès + l'invalidation
 * React Query et expose une API stable aux composants.
 *
 * Toutes les mutations partagent :
 *  - `entity` non-null + `refreshMe` provenant de `useCocolight()`
 *  - Toast i18n via namespace `modules/interop`
 *  - Invalidation de la query associée (`discourse-profil` / `mediawiki-contribs`)
 */

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { INTEROP_QUERY_KEYS } from "../constants/queryKeys";
import {
  asInteropEntity,
  type EntityWithInterop,
  type DiscourseLinkResult,
  type DiscourseCheckEmailResult,
  type DiscourseSimpleResult,
  type MediawikiResult,
} from "./_interopEntity";

// ============================================================================
// FACTORY
// ============================================================================

interface InteropMutationConfig<TParams, TData> {
  /** Action à exécuter — reçoit l'entité résolue (non-null) et les params dynamiques. */
  action: (entity: EntityWithInterop, params: TParams) => Promise<TData>;
  /** Clés i18n pour les toasts (relatives au namespace `modules/interop`). */
  i18n: {
    successKey: string;
    errorKey: string;
  };
  /** Query keys à invalider au succès (default: aucune). */
  invalidate?: QueryKey[];
  /** Si `true`, déclenche `refreshMe()` au succès (default: true). */
  refreshMeOnSuccess?: boolean;
}

/**
 * Crée un hook de mutation interop typé avec toasts + invalidation automatique.
 *
 * @example
 * export const useDiscourseLink = createInteropMutation<string, DiscourseLinkResult>({
 *   action: (entity, username) => entity.linkDiscourseAccount(username),
 *   i18n: { successKey: "toasts.discourse.linkSuccess", errorKey: "toasts.discourse.linkError" },
 *   invalidate: [INTEROP_QUERY_KEYS.DISCOURSE_PROFIL_PREFIX()],
 * });
 */
function createInteropMutation<TParams = void, TData = unknown>(
  config: InteropMutationConfig<TParams, TData>,
) {
  return function useInteropMutation() {
    const { entity, refreshMe } = useCocolight();
    const queryClient = useQueryClient();
    const refreshMeOnSuccess = config.refreshMeOnSuccess ?? true;

    return useMutationWithToast<TData, TParams>({
      mutationFn: async (params) => {
        if (!entity) throw new Error("Aucune entité disponible pour la mutation interop");
        return config.action(asInteropEntity(entity), params);
      },
      namespace: "modules/interop",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      invalidateQueries: config.invalidate ?? [],
      onSuccessCallback: () => {
        if (refreshMeOnSuccess) {
          void refreshMe();
        }
        // useMutationWithToast invalide via React Query côté hook, mais on garde
        // un fallback explicite ici au cas où le hook serait amené à invalider
        // une query externe au pattern (defensive — pas strictement requis).
        (config.invalidate ?? []).forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      },
    });
  };
}

// ============================================================================
// DISCOURSE
// ============================================================================

export const useDiscourseLink = createInteropMutation<string, DiscourseLinkResult>({
  action: (entity, username) => entity.linkDiscourseAccount(username),
  i18n: {
    successKey: "toasts.discourse.linkSuccess",
    errorKey: "toasts.discourse.linkError",
  },
  invalidate: [INTEROP_QUERY_KEYS.DISCOURSE_PROFIL_PREFIX()],
});

export const useDiscourseUnlink = createInteropMutation<void, DiscourseSimpleResult>({
  action: (entity) => entity.unlinkDiscourseAccount(),
  i18n: {
    successKey: "toasts.discourse.unlinkSuccess",
    errorKey: "toasts.discourse.unlinkError",
  },
  invalidate: [INTEROP_QUERY_KEYS.DISCOURSE_PROFIL_PREFIX()],
});

/**
 * @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu
 * (auto-suggestion de liaison Discourse si l'email du user correspond à un compte existant).
 *
 * Note : pas de toast succès (la mutation retourne juste un booléen — l'UI consommatrice
 * décide quoi afficher selon `found`).
 */
export const useDiscourseCheckEmail = createInteropMutation<void, DiscourseCheckEmailResult>({
  action: (entity) => entity.checkDiscourseEmailMatch(),
  i18n: {
    successKey: "toasts.discourse.checkEmailError", // jamais affiché — pas de side-effect
    errorKey: "toasts.discourse.checkEmailError",
  },
  refreshMeOnSuccess: false,
});

export const useDiscourseDismiss = createInteropMutation<void, DiscourseSimpleResult>({
  action: (entity) => entity.dismissDiscourseLink(),
  i18n: {
    successKey: "toasts.discourse.dismissSuccess",
    errorKey: "toasts.discourse.dismissError",
  },
});

// ============================================================================
// MEDIAWIKI
// ============================================================================

export const useMediawikiLink = createInteropMutation<string, MediawikiResult>({
  action: (entity, username) => entity.linkMediaWikiAccount(username),
  i18n: {
    successKey: "toasts.mediawiki.linkSuccess",
    errorKey: "toasts.mediawiki.linkError",
  },
  invalidate: [INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS_PREFIX()],
});

export const useMediawikiUnlink = createInteropMutation<void, MediawikiResult>({
  action: (entity) => entity.unlinkMediaWikiAccount(),
  i18n: {
    successKey: "toasts.mediawiki.unlinkSuccess",
    errorKey: "toasts.mediawiki.unlinkError",
  },
  invalidate: [INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS_PREFIX()],
});
