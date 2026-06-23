import type { Organization } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useSite } from "@/hooks/useSite";
import { PROFIL_QUERY_KEYS } from "../constants";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";
import { submitEntityEdit } from "./submitEntityEdit";

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
export function useEditTiersLieu(organization: Organization | null) {
  const { config } = useSite();

  return useMutationWithToast<{ organization: Organization }, TiersLieuxSubmitPayload>({
    mutationFn: async (data) => {
      if (!organization) throw new Error("No organization provided");
      const existingTags = (organization.serverData?.tags as string[] | undefined) ?? [];
      const addTags = config.costum?.mainTag ? [config.costum.mainTag] : [];
      // Pattern unifié (S6) : payload COMPLET (vides typés "") → Object.assign sur le draft → save().
      // Le SDK diffe en interne (n'envoie que les champs réellement changés) et le backend efface les vides
      // ($unset). Plus de diff/reconcile côté site (ni isSameValue, ni reconcileClearedFields, ni baseline) :
      // l'effacement d'un champ vidé est absorbé nativement. L'adresse (objet 14 champs, round-trip complet)
      // == serveur si non touchée → no-op au diff SDK. Prouvé 5080↔5099 par unified-save-clear.test.ts.
      const payload = buildTiersLieuxPayload(data, { existingTags, addTags, complete: true });
      // Orchestrateur unifié : Object.assign(draft) + logo + save() + suppression image éventuelle.
      const { _imageDeleted } = data as TiersLieuxSubmitPayload & { _imageDeleted?: boolean };
      await submitEntityEdit(organization, payload, { imageFile: data._logoFile, imageDeleted: _imageDeleted });

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "EditTiersLieux.toast.success",
    errorKey: "EditTiersLieux.toast.error",
    invalidateQueries: organization?.slug
      ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(organization.slug)]
      : [],
  });
}
