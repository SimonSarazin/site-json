import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Hook pour mettre à jour les informations d'un profil
 *
 * @param entity - L'entité à mettre à jour
 * @param options - Options pour la mutation (optimistic updates)
 * @returns Mutation React Query
 *
 * @example
 * const updateMutation = useUpdateProfile(entity, { optimistic: true });
 * updateMutation.mutate({
 *   name: "Nouveau nom",
 *   description: "Nouvelle description"
 * });
 */
export function useUpdateProfile(
  entity: EntityTypes | null,
) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (newData: Record<string, any>) => {
      if (!entity) {
        throw new Error("No entity provided");
      }
      
      // Modifier les données du Proxy
      Object.assign(entity.data, newData);

      // Sauvegarder via l'API
      const result = await entity.save();

      return { entity, result };
    },

    onSuccess: () => {
      if (entity) {
        // Invalider le cache pour forcer un re-fetch
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      toast.success(t("toast.profile.updateSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.profile.updateError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour uploader une image de profil
 *
 * @param entity - L'entité dont on veut modifier l'image
 * @returns Mutation React Query
 *
 * @example
 * const uploadMutation = useUploadProfileImage(entity);
 * uploadMutation.mutate(file);
 */
export function useUploadProfileImage(
  entity: EntityTypes | null,
) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (file: File) => {
      if (!entity) {
        throw new Error("No entity provided");
      }

      entity.data.profil_avatar = file;

      await entity.save();

      return { entity, result: null };
    },

    onSuccess: () => {
      if (entity) {
        // Invalider le cache pour afficher la nouvelle image
        queryClient.invalidateQueries({ queryKey: ["element-about", entity.slug] });
      }
      console.log("Entity after image upload:", entity?.serverData);

      toast.success(t("toast.profile.imageUploadSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");
      toast.error(t("toast.profile.imageUploadError"), {
        description: errorMessage,
      });
    },
  });
}

/**
 * Hook pour uploader une bannière de profil
 * @param entity - L'entité dont on veut modifier la bannière
 * @returns Mutation React Query
 *
 * @example
 * const uploadMutation = useUploadProfileBanner(entity);
 * uploadMutation.mutate({ file, cropX, cropY, cropW, cropH });
 */
export function useUploadProfileBanner(
  entity: EntityTypes | null,
) {
  // const queryClient = useQueryClient();
  const t = useT("modules/profil");

  return useMutation({
    mutationFn: async (data: { file: File; cropX: number; cropY: number; cropW: number; cropH: number }) => {
      if (!entity) {
        throw new Error("No entity provided");
      }
      
      await entity.updateImageBanner({ banner: data.file, cropW: data.cropW, cropH: data.cropH, cropX: data.cropX, cropY: data.cropY });
      
      return { entity, result: null };
    },

    onSuccess: async () => {
      if (entity) {
        await entity.refresh();
      }
      toast.success(t("toast.profile.bannerUploadSuccess"));
    },

    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("toast.error.generic");

      toast.error(t("toast.profile.bannerUploadError"), {
        description: errorMessage,
      });
    },
  });
}