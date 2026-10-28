/**
 * Champs du formulaire d'édition de profil CITOYEN visibles seulement si le site les active, via
 * `config.costum.citizenProfileFields` (`z.array(z.enum(["territoires","structureRegister"]))`, opt-in,
 * AUCUN site ne les a par défaut). Premier usage : parent62 (`territoires`, liste fermée de 9 valeurs
 * propres à ce réseau, `src/data/territoires62.ts` ; `structureRegister`, employeur en texte libre).
 *
 * Les deux pipelines read/write existent déjà GÉNÉRIQUEMENT (`PROFIL_DESCRIPTORS.citoyens.fields`,
 * `editProfilePayload.ts`) : `mergeRenderPipeline` les pose sur `MERGED_EDIT_DESCRIPTORS.citoyens` en
 * `widget:"hidden"` faute de pendant de rendu dans le descripteur générique (`editProfile.descriptor.ts`
 * ne les déclare PAS, exprès) — inoffensif pour tout site qui ne déclare pas le flag : les champs
 * restent cachés, jamais soumis. `withExtraCitizenFields` pose la vue (widget/options/libellés) du
 * sous-ensemble demandé et l'insère dans l'onglet « Contact » — appelée depuis `editProfile.tsx` avec
 * la liste lue sur `ctx.costum?.citizenProfileFields`. Un site qui ne déclare rien reçoit le
 * descripteur et le comportement inchangés, byte pour byte.
 */
import type { FieldDescriptor, FormDescriptor } from "@/modules/formEngine";
import { TERRITOIRES_62 } from "@/data/territoires62";

const PE = (k: string) => `ProfileEdit.fields.${k}`;

const TERRITOIRE_OPTIONS = TERRITOIRES_62.map((t) => ({ value: t.label, label: t.label }));

/** Pose la vue (widget/label/options) d'un champ PIPELINE déjà présent (caché), sans toucher read/write. */
function withView(field: FieldDescriptor, view: Partial<FieldDescriptor>): FieldDescriptor {
  return { ...field, ...view };
}

/** Vue de chaque champ activable — ajouter une entrée ici (+ l'enum du schéma) pour un futur champ du même genre. */
const CITIZEN_FIELD_VIEWS: Record<string, (field: FieldDescriptor) => FieldDescriptor> = {
  territoires: (field) =>
    withView(field, {
      widget: "select",
      enum: TERRITOIRE_OPTIONS,
      label: PE("territoires.label"),
      placeholder: PE("territoires.placeholder"),
      info: PE("territoires.description"),
    }),
  structureRegister: (field) =>
    withView(field, {
      widget: "text",
      label: PE("structureRegister.label"),
      placeholder: PE("structureRegister.placeholder"),
      info: PE("structureRegister.description"),
    }),
};

/**
 * Écrit les champs activés après le save principal, via `entity.updateField()` — ils sont posés
 * `readOnly` côté pipeline (`editProfilePayload.ts`) : absents du schéma JSON bundlé du SDK, un
 * `element/save` qui les porterait lèverait `[DraftProxy] Le champ "…" n'est pas autorisé` (mesuré en
 * navigateur, 23/10/2026). `updateField()` (→ `UPDATE_PATH_VALUE` côté backend) n'est PAS validé par ce
 * schéma — seulement par l'autorisation (cf. spec backend) — c'est le SEUL canal qui fonctionne pour un
 * champ hors schéma. PAS un stamp `channel:"pathValue"` classique : celui-ci lit la valeur sur le
 * payload déjà construit, qui ne porte plus ces champs une fois `readOnly` posé.
 *
 * Best-effort PAR CHAMP (un échec n'empêche pas de tenter les autres), mais le résultat AGRÉGÉ est
 * REMONTÉ (rejet) si au moins un champ a échoué : contrairement aux stamps pathValue (enrichissement
 * best-effort d'un champ que l'utilisateur n'a pas saisi lui-même), ces champs sont des valeurs que
 * l'utilisateur vient d'éditer dans CE formulaire — un échec muet lui ferait lire un succès pour une
 * écriture qui n'a pas eu lieu. `editProfile.tsx` propage ce rejet à `EntityFormModal.commit`, qui
 * affiche un toast d'erreur dédié.
 */
export async function writeExtraCitizenFields(
  entity: { updateField?: (path: string, value: unknown) => Promise<unknown> } | null | undefined,
  values: Record<string, unknown>,
  fieldNames: readonly string[],
): Promise<void> {
  if (!entity?.updateField) return;
  const failed: string[] = [];
  for (const field of fieldNames) {
    if (!(field in CITIZEN_FIELD_VIEWS)) continue;
    const value = values[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    try {
      await entity.updateField(field, trimmed === "" ? null : trimmed);
    } catch (err) {
      console.warn(`[editProfileExtraCitizenFields] échec écriture « ${field} »`, err);
      failed.push(field);
    }
  }
  if (failed.length) throw new Error(`Échec d'écriture : ${failed.join(", ")}`);
}

export function withExtraCitizenFields(base: FormDescriptor, fieldNames: readonly string[]): FormDescriptor {
  const fields = { ...base.fields };
  const ajoutsContact: string[] = [];

  for (const name of fieldNames) {
    const pipelineField = base.fields[name];
    const view = CITIZEN_FIELD_VIEWS[name];
    if (!pipelineField || !view) continue; // garde-fou : flag de config sans pendant pipeline
    fields[name] = view(pipelineField);
    ajoutsContact.push(name);
  }
  if (ajoutsContact.length === 0) return base;

  return {
    ...base,
    fields,
    sections: base.sections.map((s) =>
      s.id === "contact" && s.groups
        ? { ...s, groups: s.groups.map((g, i) => (i === 0 ? { ...g, fields: [...g.fields, ...ajoutsContact] } : g)) }
        : s,
    ),
  };
}
