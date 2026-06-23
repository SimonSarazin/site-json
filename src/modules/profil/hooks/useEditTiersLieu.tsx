/**
 * Édite une organisation tiers-lieu existante — MINCE SPEC au-dessus de `useEntityMutation`.
 * Payload COMPLET (S6) via buildTiersLieuxPayload({existingTags, addTags:mainTag, complete:true}) →
 * submitEntityEdit (Object.assign + save + suppression logo). cf. useEntityMutation.
 */
import type { Organization } from "@communecter/cocolight-api-client";
import { useSite } from "@/hooks/useSite";
import { PROFIL_QUERY_KEYS } from "../constants";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../utils/tiersLieux.schema";
import { useEntityMutation } from "./useEntityMutation";

export function useEditTiersLieu(organization: Organization | null) {
  const { config } = useSite();
  const existingTags = (organization?.serverData?.tags as string[] | undefined) ?? [];
  const addTags = config.costum?.mainTag ? [config.costum.mainTag] : [];
  return useEntityMutation({
    mode: "edit", entityType: "organizations", target: organization,
    imageField: "_logoFile",
    // Tags : merge des existants + mainTag (sans dupliquer). complete:true → payload COMPLET (vides typés ""),
    // le SDK diffe / le backend $unset. Adresse round-trip 14 champs → no-op si non touchée.
    buildPayload: (d) => buildTiersLieuxPayload(d as unknown as TiersLieuxSubmitPayload, { existingTags, addTags, complete: true }),
    successKey: "EditTiersLieux.toast.success", errorKey: "EditTiersLieux.toast.error",
    errorContext: "useEditTiersLieu · EDIT_TIERSLIEU",
    invalidateQueries: organization?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(organization.slug)] : [],
  });
}
