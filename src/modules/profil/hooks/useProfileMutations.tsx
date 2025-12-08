import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "./core";
import { QUERY_KEYS } from "../constants";

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

      // Modifier les données du Proxy
      Object.assign(entity.data, newData);

      // Sauvegarder via l'API
      const result = await entity.save();

      return { entity, result };
    },
    successKey: "toast.profile.updateSuccess",
    errorKey: "toast.profile.updateError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
    successKey: "toast.profile.imageUploadSuccess",
    errorKey: "toast.profile.imageUploadError",
    invalidateQueries: entity ? [QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
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
