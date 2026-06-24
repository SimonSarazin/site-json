/**
 * Config de la modale tiers-lieu (costum FranceTiersLieux) pour `EntityFormModal` — remplace
 * `TiersLieuxGenericModal.tsx`. READ/WRITE passent par le pipeline config-driven (tiersLieuxMapping) ;
 * le contexte costum CREATE (type/preferences) est dans la config (submit.extraData), les tags via ctx.costum.
 */
import type { EntityTypes, Organization } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { getSlug } from "@/lib/constant/common";
import { tiersLieuDescriptor } from "../tiersLieu.descriptor";
import { mapEntityToTiersLieuxValues, buildTiersLieuxPayload, type CostumConfig } from "../../utils/tiersLieuxMapping";
import { getDefaultTiersLieuxValues, type TiersLieuxSubmitPayload } from "../../utils/tiersLieux.schema";
import type { EntityModalConfig } from "../EntityFormModal";

/** Slug du costum = slug de l'entité porteuse (VITE_SLUG) ; fallback getSlug(). */
const carrierSlug = (carrier: EntityTypes | null | undefined): string => {
  const s = carrier?.serverData?.slug;
  return typeof s === "string" && s.trim() ? s.trim() : getSlug();
};

export const tiersLieuModalConfig: EntityModalConfig = {
  descriptor: tiersLieuDescriptor,
  title: { add: "AddTiersLieux.title", edit: "EditTiersLieux.title" },
  submitLabel: { add: "AddTiersLieux.buttons.submit", edit: "EditTiersLieux.buttons.submit" },
  icon: tiersLieuDescriptor.icon,
  gradientHeader: true,
  dialogClassName: "sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden",
  validationFailedKey: "AddTiersLieux.errors.validationFailed",
  imageField: "_logoFile",
  imageExistingUrl: (org) => {
    const sd = (org as Organization).serverData;
    return sd?.profilMediumImageUrl || sd?.profilImageUrl || sd?.profilThumbImageUrl || undefined;
  },
  texts: (t) => ({
    next: t("AddTiersLieux.buttons.next"),
    previous: t("AddTiersLieux.buttons.previous"),
    cancel: t("AddTiersLieux.buttons.cancel"),
    stepLabel: (index, total) => `${t("AddTiersLieux.step")} ${index} ${t("AddTiersLieux.stepOf")} ${total}`,
  }),

  // READ : édition → mapEntityToTiersLieuxValues (pipeline) ; création → socle par défaut.
  buildDefaults: ({ mode, entity }) =>
    (mode === "edit" && entity
      ? mapEntityToTiersLieuxValues(entity)
      : getDefaultTiersLieuxValues()) as unknown as FieldValues,

  // WRITE : create scopé costum (me.costum(carrierSlug).organization) ; edit = payload complet + merge tags.
  buildSpec: ({ mode, entity, parent, me, carrier, costum }) => {
    const co = costum as CostumConfig | undefined;
    if (mode === "edit") {
      const existingTags = (entity?.serverData?.tags as string[] | undefined) ?? [];
      const addTags = co?.mainTag ? [co.mainTag] : [];
      return {
        mode: "edit", entityType: "organizations", target: entity, imageField: "_logoFile",
        buildPayload: (d) => buildTiersLieuxPayload(d as unknown as TiersLieuxSubmitPayload, { existingTags, addTags, complete: true }),
        successKey: "EditTiersLieux.toast.success", errorKey: "EditTiersLieux.toast.error",
        errorContext: "EntityFormModal · EDIT_TIERSLIEU",
        invalidateQueries: entity?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : [],
      };
    }
    const target = parent ?? me;
    return {
      mode: "add", entityType: "organizations", target: parent ?? null,
      costumSlug: carrierSlug(carrier), imageField: "_logoFile",
      buildPayload: (d) => buildTiersLieuxPayload(d as unknown as TiersLieuxSubmitPayload, co ? { costum: co } : undefined),
      successKey: "AddTiersLieux.toast.success", errorKey: "AddTiersLieux.toast.error",
      errorContext: "EntityFormModal · ADD_TIERSLIEU",
      invalidateQueries: target ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(target.slug)] : [],
    };
  },
};
