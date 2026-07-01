/**
 * Config d'ÉDITION de profil (citoyen/org/projet/event/poi) pour `EntityFormModal` — entityType-aware
 * (descripteur/schéma/spec résolus depuis l'entité au runtime). Remplace le corps de `EditProfileGenericModal`
 * (qui ne reste qu'un mince ROUTER vers cette config OU le legacy EditProfileModal pour les types non migrés).
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { getProfileSchema } from "../../schemaForm";
import { MERGED_EDIT_DESCRIPTORS } from "../profilMerged";
import { seedEntity, buildPayload, type EntityLike } from "@/modules/formEngine/engine/entityForm";
import type { EntityModalConfig, EntityModalCtx } from "../EntityFormModal";
import type { EntityKind } from "../../hooks/useEntityMutation";

const typeOf = (ctx: EntityModalCtx): string =>
  (typeof ctx.entity?.getEntityType === "function" ? ctx.entity.getEntityType() : "citoyens");

export const editProfileConfig: EntityModalConfig = {
  // UN SEUL descripteur fusionné (rendu + read/write) par type — cf. profilMerged / mergeRenderPipeline.
  descriptor: (ctx) => MERGED_EDIT_DESCRIPTORS[typeOf(ctx)],
  title: { add: "ProfileEdit.title", edit: "ProfileEdit.title" },
  submitLabel: { add: "ProfileEdit.save", edit: "ProfileEdit.save" },
  texts: (t) => ({ next: "", previous: "", cancel: t("ProfileEdit.cancel") }),
  getSchema: (ctx) => getProfileSchema(typeOf(ctx)),

  // READ : seedEntity sur le descripteur FUSIONNÉ (= ex-seedProfileFormValues, prouvé identique par profilDerived).
  buildDefaults: ({ entity }) =>
    (entity ? seedEntity({ descriptor: MERGED_EDIT_DESCRIPTORS[typeOf({ mode: "edit", entity })] }, entity as EntityLike) : {}) as FieldValues,

  // events : filtre runtime du finder `parent` (sous-événement) = events organisés par le parent de l'entité.
  buildFieldProps: ({ entity }) => {
    if (typeOf({ mode: "edit", entity }) !== "events") return undefined;
    const pid = (entity as { parent?: { id?: string } } | null)?.parent?.id;
    return pid ? { parent: { filters: { filters: { [`organizer.${pid}`]: { $exists: true } } } } } : undefined;
  },

  // WRITE : buildPayload (omit-empty) sur le descripteur FUSIONNÉ (= ex-buildProfileUpdateData, prouvé identique
  // par profilDerived) : un champ string vidé émet "" (effacé), un write → undefined (number/adresse incomplète)
  // est OMIS. NB : tension avec le contrat de submitEntityEdit (« jamais omit-empty ») → effacement OK pour les
  // string, mais un champ undefined-producing n'est pas effacé ici.
  buildSpec: (ctx) => {
    const et = typeOf(ctx);
    return {
      mode: "edit", entityType: et as EntityKind, target: ctx.entity,
      buildPayload: (d) => buildPayload({ descriptor: MERGED_EDIT_DESCRIPTORS[et] }, d),
      successKey: "toast.profile.updateSuccess", errorKey: "toast.profile.updateError",
      errorContext: `EntityFormModal · UPDATE ${et}`,
      invalidateQueries: ctx.entity?.slug ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(ctx.entity.slug)] : [],
    };
  },

  // Slug changé → recharger sur la nouvelle URL (effet hors moteur, parité ancien modal).
  afterSubmit: ({ entity }, values) => {
    const oldSlug = (entity as EntityTypes | null)?.slug;
    const newSlug = values.slug as string | undefined;
    if (newSlug && oldSlug && newSlug !== oldSlug && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname.replace(oldSlug, newSlug));
      window.location.reload();
    }
  },
};
