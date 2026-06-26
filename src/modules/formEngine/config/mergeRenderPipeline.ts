/**
 * `mergeRenderPipeline(render, pipeline)` — DÉRIVE un descripteur UNIFIÉ (render + read/write) en
 * superposant les props PIPELINE (read/write/group/…) d'un descripteur pipeline sur le descripteur de RENDU
 * homonyme. Permet d'obtenir « un descripteur unifié config-convertible » pour les entités STANDARD
 * (citoyen/org/projet/event/poi) SANS toucher leurs sources DRY : le rendu (add/edit, différents) et le
 * pipeline (PROFIL_DESCRIPTORS, PARTAGÉ par add+edit) restent séparés ; on les combine au moment de
 * générer la config. cf. doc/formulaire-config-driven.md.
 *
 * Règle de fusion (parité byte GARANTIE par construction) :
 *  - champ de RENDU AVEC pendant pipeline homonyme → on superpose read/write/group/path/writeOnly/readOnly/
 *    clear/default (le RENDU garde widget/type/label/sections/validation) ;
 *  - champ de RENDU SANS pendant pipeline → ancre/composite UI (location/editSocial/editSchedule/eventDates)
 *    OU champ rendu-mais-non-piloté (ex. event.description) → `renderOnly` (ni lu ni écrit, comme aujourd'hui) ;
 *  - champ PIPELINE-only (absent du rendu : adresse/social/geo/horaires plats…) → ajouté tel quel (hidden,
 *    non rendu car hors sections) ;
 *  - `serializeGroups` : repris du pipeline.
 * Conséquence : l'ENSEMBLE des champs lus/écrits du descripteur fusionné = exactement celui du pipeline
 * (les renderOnly sont ignorés par seedFromEntity/valuesToPayload) → seedEntity/buildPayload IDENTIQUES.
 */
import type { FieldDescriptor, FormDescriptor } from "../types";

/** Props PIPELINE superposées sur le champ de RENDU homonyme (toutes sérialisables). */
const PIPELINE_KEYS = ["read", "write", "group", "path", "writeOnly", "readOnly", "clear", "default"] as const;

export function mergeRenderPipeline(render: FormDescriptor, pipeline: FormDescriptor): FormDescriptor {
  const fields: Record<string, FieldDescriptor> = {};

  for (const [name, rf] of Object.entries(render.fields)) {
    const pf = pipeline.fields[name];
    if (!pf) {
      // Rendu sans pendant pipeline = composite UI / champ non piloté → renderOnly (skip read ET write).
      fields[name] = { ...rf, renderOnly: true };
      continue;
    }
    const overlay: Record<string, unknown> = {};
    for (const k of PIPELINE_KEYS) {
      const v = (pf as unknown as Record<string, unknown>)[k];
      if (k === "default") {
        if (v !== undefined && rf.default === undefined) overlay.default = v; // le RENDU prime s'il a déjà un défaut
      } else if (v !== undefined && v !== false) {
        overlay[k] = v; // read/write/group/path/clear (valeurs) + writeOnly/readOnly (true seulement)
      }
    }
    fields[name] = { ...rf, ...overlay } as FieldDescriptor;
  }

  // Champs PIPELINE-only (adresse/social/geo plats, openingHours, dates…) : ajoutés tels quels.
  for (const [name, pf] of Object.entries(pipeline.fields)) {
    if (!(name in render.fields)) fields[name] = pf;
  }

  return {
    ...render, // id/collection/icon/costumSlug/layout/sections/validate : le RENDU fait foi
    ...(pipeline.serializeGroups ? { serializeGroups: pipeline.serializeGroups } : {}),
    fields,
  };
}
