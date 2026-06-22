import type { Organization } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useSite } from "@/hooks/useSite";
import { PROFIL_QUERY_KEYS } from "../constants";
import { buildTiersLieuxPayload, mapEntityToTiersLieuxValues } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";
import { isSameValue, reconcileClearedFields } from "@/modules/formEngine";

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
      const opts = { existingTags, addTags };
      const payload = buildTiersLieuxPayload(data, opts);
      // Baseline reconstruite depuis l'ENTITÉ (mêmes options) pour ne réassigner QUE le réellement
      // modifié — sinon l'objet `address` reconstruit (partiel si l'adresse n'a pas été ré-éditée)
      // écrase l'adresse serveur complète (perte de level2..4/codeInsee/geo). cf. POI buildEditDelta.
      const baseline = buildTiersLieuxPayload(mapEntityToTiersLieuxValues(organization), opts) as Record<string, unknown>;

      const target = organization.data as Record<string, unknown>;
      // Réassigne au draft les champs MODIFIÉS (`tags` toujours, pour garantir mainTag/compagnon).
      for (const [key, value] of Object.entries(payload)) {
        if (key === "tags" || !isSameValue(value, baseline[key])) target[key] = value;
      }
      // EFFACEMENT : `buildTiersLieuxPayload` OMET les champs vides → une clé du baseline (valeur serveur)
      // absente du payload = champ VIDÉ par l'utilisateur → on l'efface explicitement (vide typé) sinon `save()`
      // ne voit aucun changement. `address` (atomique/obligatoire) et `tags` (mergés) exclus.
      // cf. reconcileClearedFields (formEngine) + doc/refactor-field-treatment.md (P0).
      const cleared = reconcileClearedFields(payload, baseline, { skip: ["tags", "address"] });
      for (const [key, value] of Object.entries(cleared)) target[key] = value;
      // Logo posé dans le draft : `save()` (→ `_update`) le route vers le bloc PROFIL_IMAGE (`updateImageProfil`).
      if (data._logoFile) {
        target.profil_avatar = data._logoFile;
      }

      await organization.save();

      // Suppression du logo existant (✕ sans nouveau fichier) : le logo n'est pas un champ DATA,
      // donc hors `save()`. `removeProfilImage` récupère le docId (DOCUMENT_LIST) puis `deleteFile`.
      // `_imageDeleted` est posé par le widget image du moteur générique (absent de l'ancien form).
      const { _imageDeleted } = data as TiersLieuxSubmitPayload & { _imageDeleted?: boolean };
      if (_imageDeleted && !data._logoFile) {
        await organization.removeProfilImage();
      }

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
