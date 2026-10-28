/**
 * Config d'ÉDITION de profil (citoyen/org/projet/event/poi) pour `EntityFormModal` — entityType-aware
 * (descripteur/schéma/spec résolus depuis l'entité au runtime). Remplace le corps de `EditProfileGenericModal`
 * (qui ne reste qu'un mince ROUTER vers cette config OU le legacy EditProfileModal pour les types non migrés).
 */
import { reloadOnSlugChange } from "../../lib/reloadOnSlugChange";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { FieldValues } from "react-hook-form";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { getProfileSchema } from "../../schemaForm";
import { MERGED_EDIT_DESCRIPTORS } from "../profilMerged";
import { seedEntity, buildPayload, type EntityLike } from "@/modules/formEngine/engine/entityForm";
import type { EntityModalConfig, EntityModalCtx } from "../EntityFormModal";
import type { EntityKind } from "../../hooks/useEntityMutation";
import type { SiteConfig } from "@/types/site-schema";
import { withExtraCitizenFields, writeExtraCitizenFields } from "./editProfileExtraCitizenFields";

const typeOf = (ctx: EntityModalCtx): string =>
  (typeof ctx.entity?.getEntityType === "function" ? ctx.entity.getEntityType() : "citoyens");

// Liste vide pour tout site qui ne déclare pas le flag (AUCUN par défaut) — opt-in pur config, jamais de slug en dur.
const extraCitizenFields = (ctx: EntityModalCtx): readonly string[] =>
  typeOf(ctx) === "citoyens" ? ((ctx.costum as SiteConfig["costum"])?.citizenProfileFields ?? []) : [];

export const editProfileConfig: EntityModalConfig = {
  // UN SEUL descripteur fusionné (rendu + read/write) par type — cf. profilMerged / mergeRenderPipeline.
  // `withExtraCitizenFields` : SEULE la vue (widget/options des champs activés par
  // `config.costum.citizenProfileFields`, déjà présents cachés dans le pipeline générique) change —
  // read/write sont IDENTIQUES partout, inutile de conditionner buildDefaults/buildSpec ci-dessous.
  descriptor: (ctx) => {
    const d = MERGED_EDIT_DESCRIPTORS[typeOf(ctx)];
    const fields = extraCitizenFields(ctx);
    return fields.length ? withExtraCitizenFields(d, fields) : d;
  },
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

  // Slug changé → recharger sur la nouvelle URL (effet hors moteur, parité ancien modal). Champs
  // opt-in (`config.costum.citizenProfileFields`) : écrits séparément, hors du schéma SDK — cf.
  // editProfileExtraCitizenFields.ts. Le reload doit attendre cette écriture : sinon
  // window.location.reload() coupe la requête updateField en vol si slug ET un champ opt-in
  // changent dans la même sauvegarde. La promesse est RETOURNÉE (pas `void`) : `EntityFormModal.commit`
  // l'attend pour rejouer l'invalidation après l'écriture et, si elle rejette, afficher un toast
  // d'erreur dédié — un échec d'écriture ne doit pas rester muet derrière le toast de succès déjà
  // affiché pour la sauvegarde principale.
  afterSubmit: (ctx, values) => {
    const reload = () => reloadOnSlugChange((ctx.entity as EntityTypes | null)?.slug, values.slug);
    const fields = extraCitizenFields(ctx);
    if (!fields.length) { reload(); return; }
    return writeExtraCitizenFields(ctx.entity, values, fields).finally(reload);
  },
};
