/**
 * Payload de CRÉATION du POI STANDARD (org/projet/event/poi via `configs/addStandard`). Réutilise le PIPELINE
 * du descripteur équipement (mêmes groupes `address`/`geo`, mêmes coercions) comme PONT transitoire — le poi
 * standard n'a pas (encore) son propre descripteur de write. Déplacé hors de `costum/equipements-sportifs/fns`
 * (où il « squattait » : il ne concerne PAS le costum, qui passe par le pipeline générique).
 *
 * Imports side-effect : enregistrent les transforms WRITE référencés par le descripteur (address:write,
 * geo:write/geoPosition:write) — pour que `buildPayload` fonctionne même importé seul (tests).
 */
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import type { FormValues } from "@/modules/formEngine";
import "@/modules/formEngine/engine/coercions";
import "./costum/sharedCodecs"; // address:read/write
import "./geoTransforms"; // geo:write / geoPosition:write
import { equipementsSportifsDescriptor } from "./costum/equipements-sportifs/descriptor";

const POI_SPEC: FormSpec = { descriptor: equipementsSportifsDescriptor };

/**
 * Form → payload de création POI (pipeline, omit-empty) : adresse imbriquée, geo coercé, champs typés. `type`
 * n'est plus un champ du descripteur équipement (devenu STAMP costum) → réémis ici depuis `data` (le poi
 * standard porte SON type, ex. "place", via le form).
 */
export function buildAddPoiPayload(data: FormValues): Record<string, unknown> {
  const payload = buildPayload(POI_SPEC, data) as Record<string, unknown>;
  if (data.type) payload.type = data.type;
  return payload;
}
