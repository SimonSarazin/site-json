import type { Organization } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useSite } from "@/hooks/useSite";
import { PROFIL_QUERY_KEYS } from "../constants";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";

/**
 * Édite une organisation tiers-lieu existante.
 *
 * Pattern entity-oriented : on assigne les champs sur `organization.data` puis
 * `organization.save()` persiste. Le SDK gère la diff/patch et la réhydratation
 * de `serverData` après la sauvegarde.
 *
 * Tags : on lit `organization.serverData.tags` (existant) et on injecte
 * `config.costum.mainTag` via `addTags` pour garantir sa présence après save
 * (sans écraser les tags existants ni dupliquer).
 */
export function useEditTiersLieu(organization: Organization) {
  const { config } = useSite();

  return useMutationWithToast<{ organization: Organization }, TiersLieuxSubmitPayload>({
    mutationFn: async (data) => {
      const existingTags = (organization.serverData?.tags as string[] | undefined) ?? [];
      const addTags = config.costum?.mainTag ? [config.costum.mainTag] : [];
      const payload = buildTiersLieuxPayload(data, { existingTags, addTags });

      const target = organization.data as Record<string, unknown>;
      for (const [key, value] of Object.entries(payload)) {
        target[key] = value;
      }
      // Logo posé dans le draft : `save()` (→ `_update`) le route vers le bloc
      // PROFIL_IMAGE (`updateImageProfil`) en un seul aller-retour, comme l'avatar.
      if (data._logoFile) {
        target.profil_avatar = data._logoFile;
      }

      await organization.save();

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
