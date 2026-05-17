import { useState } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { normalizeUpdatePathValuePayload } from "@/lib/updatePathValue";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { readEntityPreferences } from "@/modules/cagnotte/utils/dataTransform";

const LOG_PREFIX = "[useProjectModalPreference]";

/**
 * Indique où la sauvegarde a été persistée :
 *  - `"db"` : BDD + miroir localStorage (cas nominal).
 *  - `"local"` : BDD KO mais localStorage OK (mode dégradé).
 *  - `"none"` : aucun stockage n'a réussi (échec total).
 */
export type ProjectModalPreferenceResult = "db" | "local" | "none";

interface UseProjectModalPreferenceResult {
  /** Persiste le `projectId` comme préférence "projet principal" de l'orga. */
  save: (projectId: string) => Promise<ProjectModalPreferenceResult>;
  isSaving: boolean;
}

/**
 * Hook pour persister la préférence "projet principal" (`projectModalId`) d'une orga,
 * utilisé par le widget cagnotte du header `HeaderRezoLaMer` pour cibler la cagnotte
 * affichée. Le nom reflète l'intention : on persiste une **préférence** côté
 * `organizations.preferences`, pas une entité métier.
 *
 * Flux à 2 niveaux avec fallback :
 *  1. Tentative BDD via `updatePathValue` sur `organizations.preferences`.
 *  2. Si BDD KO → fallback localStorage (clé `projectModalId_<orgId>`).
 *  3. Si les 2 KO → toast d'erreur, `save()` retourne `"none"`.
 *
 * Les toasts succès/erreur sont gérés en interne via le namespace
 * `modules/cagnotte` (clés `CagnotteDialog.toasts.*`).
 *
 * @example
 *   const { save, isSaving } = useProjectModalPreference(entity);
 *   const onClick = async () => {
 *     const result = await save(projectId);
 *     if (result === "db") setOptimistic(projectId);
 *   };
 */
export function useProjectModalPreference(entity: EntityTypes | null): UseProjectModalPreferenceResult {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");
  const [isSaving, setIsSaving] = useState(false);

  const saveToStorage = (projectId: string): void => {
    if (typeof window === "undefined" || !window.localStorage || !entity?.id) return;
    try {
      const storageKey = `projectModalId_${entity.id}`;
      localStorage.setItem(storageKey, projectId);
    } catch (error) {
      console.warn(`${LOG_PREFIX} localStorage save failed:`, error);
      throw error;
    }
  };

  const saveToDatabase = async (projectId: string): Promise<void> => {
    if (!entity?.id) {
      throw new Error(String(t("CagnotteDialog.errors.entityUnavailable")));
    }

    const draftPrefs = readEntityPreferences(entity, "data") ?? {};
    const serverPrefs = readEntityPreferences(entity, "serverData") ?? {};
    const mergedPreferences = {
      ...serverPrefs,
      ...draftPrefs,
      projectModalId: projectId,
    };

    await entity.endpointApi.updatePathValue(
      normalizeUpdatePathValuePayload({
        id: entity.id,
        collection: "organizations",
        path: "preferences",
        value: mergedPreferences,
      }),
    );

    // Refresh non-bloquant pour resynchroniser les données locales.
    // `entity.get()` est typé natif sur BaseEntity (BaseEntity.d.ts:956).
    try {
      if (typeof entity.get === "function") {
        await entity.get();
      }
    } catch (refreshError) {
      console.warn(`${LOG_PREFIX} entity.get() refresh failed:`, refreshError);
    }
  };

  const save = async (projectId: string): Promise<ProjectModalPreferenceResult> => {
    if (!projectId || !entity) {
      showErrorToast(
        new Error(String(t("CagnotteDialog.toasts.projectRequired.description"))),
        "CagnotteDialog.toasts.errorTitle",
        t
      );
      return "none";
    }

    setIsSaving(true);
    try {
      // 1) Sauvegarde distante prioritaire.
      await saveToDatabase(projectId);
      // 2) Backup local (best-effort, n'échoue pas le flow nominal).
      try {
        saveToStorage(projectId);
      } catch {
        // déjà loggé dans saveToStorage
      }
      showSuccessToast("CagnotteDialog.toasts.saveSuccess.title", t);
      return "db";
    } catch (dbError) {
      console.error(`${LOG_PREFIX} BDD save failed:`, dbError);

      // Fallback localStorage seul.
      try {
        saveToStorage(projectId);
        showErrorToast(
          new Error(String(t("CagnotteDialog.toasts.savePartial.description"))),
          "CagnotteDialog.toasts.savePartial.title",
          t
        );
        return "local";
      } catch (localError) {
        console.error(`${LOG_PREFIX} localStorage fallback failed:`, localError);
        const message =
          dbError instanceof Error
            ? String(t("CagnotteDialog.errors.dbError", undefined, { message: dbError.message }))
            : String(t("CagnotteDialog.toasts.saveError.fallback"));
        showErrorToast(new Error(message), "CagnotteDialog.toasts.saveError.title", t);
        return "none";
      }
    } finally {
      setIsSaving(false);
    }
  };

  return { save, isSaving };
}
