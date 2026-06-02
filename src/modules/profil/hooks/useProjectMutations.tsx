import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { Project, EntityTypes } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

/**
 * @param entity L'entité (utilisateur ou organisation) à laquelle le projet sera associé
 */
export function useAddProject(entity: EntityTypes) {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();
  const entityId = entity.id || "";

  return useMutation({
    mutationFn: async ({
      projectData,
      images,
    }: {
      projectData: {
        name: string;
        shortDescription?: string;
        tags?: string[];
        url?: string;
        isPublic?: boolean;
      };
      images?: File[];
    }) => {
      if (!me) throw new Error("User not connected");

      const project = await entity.project({
        name: projectData.name,
        shortDescription: projectData.shortDescription,
        tags: projectData.tags,
        url: projectData.url,
        public: projectData.isPublic ?? true,
      });

      await project.save();

      if (images && images.length > 0 && images[0]) {
        await project.updateImageProfil({ profil_avatar: images[0] });
      }

      return { project };
    },

    onSuccess: ({ project }) => {
      queryClient.setQueryData<{ pages: Project[][] }>(
        ["profile-projects", entityId, ""],
        (old) => {
          if (!old) {
            return {
              pages: [[project]],
              pageParams: [undefined],
            };
          }

          // Ajouter au début de la première page
          const newPages = [...old.pages];
          if (newPages[0]) {
            newPages[0] = [project, ...newPages[0]];
          } else {
            newPages[0] = [project];
          }

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.PROFILE_PROJECTS_PREFIX(entityId) });

      toast.success(t("toast.project.addSuccess"));
    },

    onError: (error) => {
      console.log(error)
      toast.error(t("toast.project.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}
