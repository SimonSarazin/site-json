import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import type { Organization } from "@communecter/cocolight-api-client";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";

export type OrganizationType = "NGO" | "LocalBusiness" | "Group" | "GovernmentOrganization" | "Cooperative";
export type OrganizationRole = "admin" | "member";

export function useAddOrganization() {
  const queryClient = useQueryClient();
  const t = useT("modules/profil");
  const { me } = useCocolight();

  return useMutation({
    mutationFn: async ({
      organizationData,
      images,
    }: {
      organizationData: {
        name: string;
        type: OrganizationType;
        role: OrganizationRole;
        shortDescription?: string;
        tags?: string[];
        email?: string;
        url?: string;
      };
      images?: File[];
    }) => {
      if (!me) throw new Error("User not connected");

      const organization = await me.organization({
        name: organizationData.name,
        type: organizationData.type,
        role: organizationData.role,
        shortDescription: organizationData.shortDescription,
        tags: organizationData.tags,
        email: organizationData.email,
        url: organizationData.url,
      });

      await organization.save();

      if (images && images.length > 0 && images[0]) {
        await organization.updateImageProfil({ profil_avatar: images[0] });
      }

      return { organization };
    },

    onSuccess: ({ organization }) => {
      const userId = me?.serverData?.id || "";

      queryClient.setQueryData<{ pages: Organization[][] }>(
        ["profile-organizations", userId, ""],
        (old) => {
          if (!old) {
            return {
              pages: [[organization]],
              pageParams: [undefined],
            };
          }

          const newPages = [...old.pages];
          if (newPages[0]) {
            newPages[0] = [organization, ...newPages[0]];
          } else {
            newPages[0] = [organization];
          }

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: PROFIL_QUERY_KEYS.PROFILE_ORGANIZATIONS_PREFIX(userId) });

      toast.success(t("toast.organization.addSuccess"));
    },

    onError: (error) => {
      console.log(error);
      toast.error(t("toast.organization.addError"), {
        description: error instanceof Error ? error.message : t("toast.error.generic"),
      });
    },
  });
}
