import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../constants";
import { submitEntityEdit } from "./submitEntityEdit";
import { logCocolightError } from "./mutationUtils";

interface BannerUploadData {
  file: File;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

/**
 * Hook pour mettre à jour les informations d'un profil
 */
export function useUpdateProfile(entity: EntityTypes | null) {
  return useMutationWithToast<{ entity: EntityTypes; result: unknown }, Record<string, unknown>>({
    mutationFn: async (newData) => {
      if (!entity) {
        throw new Error("No entity provided");
      }

      // Orchestrateur unifié (S6) : Object.assign(draft) + save() (le SDK diffe, le backend efface les vides).
      // `newData` = buildProfileUpdateData (payload complet : pf:orEmpty émet "", adresse "" si vide).
      let result: unknown;
      try {
        result = await submitEntityEdit(entity as unknown as Parameters<typeof submitEntityEdit>[0], newData);
      } catch (err) {
        // ex. `UPDATE_BLOCK_INFO - The value at /parent must be an object` (parent:"" sur-émis) →
        // messages AJV champ par champ visibles dans la console du navigateur.
        logCocolightError(`useUpdateProfile · ${entity.getEntityType?.() ?? "?"}`, err, newData);
        throw err;
      }

      return { entity, result };
    },
    namespace: "modules/profil",
    successKey: "toast.profile.updateSuccess",
    errorKey: "toast.profile.updateError",
    invalidateQueries: entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
  });
}

/**
 * Hook pour uploader une image de profil
 */
export function useUploadProfileImage(entity: EntityTypes | null) {
  return useMutationWithToast<{ entity: EntityTypes; result: null }, File>({
    mutationFn: async (file) => {
      if (!entity) {
        throw new Error("No entity provided");
      }

      entity.data.profil_avatar = file;
      await entity.save();

      return { entity, result: null };
    },
    namespace: "modules/profil",
    successKey: "toast.profile.imageUploadSuccess",
    errorKey: "toast.profile.imageUploadError",
    invalidateQueries: entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
  });
}

/**
 * Hook pour uploader une bannière de profil
 */
export function useUploadProfileBanner(entity: EntityTypes | null) {
  return useMutationWithToast<{ entity: EntityTypes; result: null }, BannerUploadData>({
    mutationFn: async (data) => {
      if (!entity) {
        throw new Error("No entity provided");
      }

      await entity.updateImageBanner({
        banner: data.file,
        cropW: data.cropW,
        cropH: data.cropH,
        cropX: data.cropX,
        cropY: data.cropY,
      });

      return { entity, result: null };
    },
    namespace: "modules/profil",
    successKey: "toast.profile.bannerUploadSuccess",
    errorKey: "toast.profile.bannerUploadError",
    onSuccessCallback: async () => {
      if (entity) {
        await entity.refresh();
      }
    },
    invalidateQueries: [],
  });
}
