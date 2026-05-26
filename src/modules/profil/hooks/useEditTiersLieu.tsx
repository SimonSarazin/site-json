import type { Organization } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../constants";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";

/**
 * Édite une organisation tiers-lieu existante.
 *
 * Pattern entity-oriented : on assigne les champs sur `organization.data` puis
 * `organization.save()` persiste. Le SDK gère la diff/patch et la réhydratation
 * de `serverData` après la sauvegarde.
 */
export function useEditTiersLieu(organization: Organization) {
  return useMutationWithToast<{ organization: Organization }, TiersLieuxSubmitPayload>({
    mutationFn: async (data) => {
      const payload = buildTiersLieuxPayload(data);

      const target = organization.data as Record<string, unknown>;
      for (const [key, value] of Object.entries(payload)) {
        target[key] = value;
      }

      await organization.save();

      if (data._logoFile) {
        try {
          await organization.updateImageProfil({ profil_avatar: data._logoFile });
        } catch (err) {
          console.error("[useEditTiersLieu] Logo upload failed:", err);
        }
      }

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "EditTiersLieux.toast.success",
    errorKey: "EditTiersLieux.toast.error",
    invalidateQueries: organization.slug
      ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(organization.slug)]
      : [],
  });
}
