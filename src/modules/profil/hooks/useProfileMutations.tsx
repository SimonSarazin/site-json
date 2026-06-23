import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../constants";
import { useEntityMutation, type EntityKind } from "./useEntityMutation";

interface BannerUploadData {
  file: File;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

/**
 * Met à jour les informations d'un profil — MINCE SPEC au-dessus de `useEntityMutation`.
 * `newData` = payload COMPLET déjà construit par la modale (buildProfileUpdateData : pf:orEmpty émet "",
 * adresse "" si vide) → buildPayload = identité → submitEntityEdit (Object.assign + save, SDK diffe, backend $unset).
 */
export function useUpdateProfile(entity: EntityTypes | null) {
  return useEntityMutation({
    mode: "edit", entityType: (entity?.getEntityType?.() ?? "citoyens") as EntityKind, target: entity,
    buildPayload: (d) => d,
    successKey: "toast.profile.updateSuccess", errorKey: "toast.profile.updateError",
    errorContext: `useUpdateProfile · ${entity?.getEntityType?.() ?? "?"}`,
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
