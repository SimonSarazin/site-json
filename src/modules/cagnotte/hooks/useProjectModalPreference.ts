import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { readEntityPreferences } from "@/modules/cagnotte/utils/dataTransform";

const LOG_PREFIX = "[useProjectModalPreference]";

interface UseProjectModalPreferenceResult {
  /**
   * Persiste le `projectId` comme préférence "projet principal" de l'orga.
   * Retourne `true` si la sauvegarde BDD a réussi, `false` sinon (toast d'erreur
   * affiché automatiquement par `useMutationWithToast`).
   */
  save: (projectId: string) => Promise<boolean>;
  isSaving: boolean;
}

/**
 * Hook pour persister la préférence "projet principal" (`projectModalId`) d'une orga,
 * utilisé par le widget cagnotte du header `HeaderTransparentScroll` pour cibler la cagnotte
 * affichée. Le nom reflète l'intention : on persiste une **préférence** côté
 * `organizations.preferences`, pas une entité métier.
 *
 * Flux : `entity.updateField("preferences", merged)` sur l'orga, suivi d'un
 * `entity.get()` non bloquant pour resynchroniser les données locales. Toasts
 * succès/erreur gérés en interne via le namespace `modules/cagnotte` (clés
 * `CagnotteDialog.toasts.saveSuccess` / `CagnotteDialog.toasts.saveError`).
 *
 * @example
 *   const { save, isSaving } = useProjectModalPreference(entity);
 *   const onClick = async () => {
 *     const success = await save(projectId);
 *     if (success) setOptimistic(projectId);
 *   };
 */
export function useProjectModalPreference(entity: EntityTypes | null): UseProjectModalPreferenceResult {
  const mutation = useMutationWithToast<void, string>({
    namespace: "modules/cagnotte",
    successKey: "CagnotteDialog.toasts.saveSuccess.title",
    errorKey: "CagnotteDialog.toasts.saveError.title",
    mutationFn: async (projectId) => {
      if (!projectId) {
        throw new Error("projectId required");
      }
      if (!entity?.id) {
        throw new Error("entity required");
      }

      const draftPrefs = readEntityPreferences(entity, "data") ?? {};
      const serverPrefs = readEntityPreferences(entity, "serverData") ?? {};
      const mergedPreferences = {
        ...serverPrefs,
        ...draftPrefs,
        projectModalId: projectId,
      };

      await entity.updateField("preferences", mergedPreferences);

      // Refresh non-bloquant pour resynchroniser les données locales.
      // `entity.get()` est typé natif sur BaseEntity.
      try {
        if (typeof entity.get === "function") {
          await entity.get();
        }
      } catch (refreshError) {
        console.warn(`${LOG_PREFIX} entity.get() refresh failed:`, refreshError);
      }
    },
  });

  const save = async (projectId: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync(projectId);
      return true;
    } catch {
      return false;
    }
  };

  return { save, isSaving: mutation.isPending };
}
