/**
 * Payload de CRÉATION du POI STANDARD (org/projet/event/poi via `configs/addStandard`). Tourne sur
 * `addPoiDescriptor` — descripteur UNIQUE rendu+write (comme les costums) : le câblage d'écriture (groupe
 * `address` + geo) y vit désormais directement. Plus de descripteur d'écriture séparé (addPoi.write supprimé).
 *
 * `descriptor` reste INJECTABLE (DI) : défaut = addPoiDescriptor ; un costum peut passer le sien pour comparer
 * la parité (cf. `equipements-sportifs/spec.test` : buildAddPoiPayload(form, equipementsSportifsDescriptor)).
 */
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import type { FormValues, FormDescriptor } from "@/modules/formEngine";
import "@/modules/formEngine/engine/coercions";
import "./costum/sharedCodecs"; // address:read/write (référencés par serializeGroups.address)
import "./geoTransforms"; // geo:write / geoPosition:write
import { addPoiDescriptor } from "./addPoi.descriptor";

/**
 * Form → payload de création POI (pipeline, omit-empty) : adresse imbriquée, geo coercé, champs typés. `type`
 * réémis depuis `data` (utile quand le descripteur passé n'a PAS de champ `type`, ex. equipements où c'est un
 * STAMP ; pour addPoiDescriptor `type` est déjà un champ → réémission idempotente).
 */
export function buildAddPoiPayload(data: FormValues, descriptor: FormDescriptor = addPoiDescriptor): Record<string, unknown> {
  const payload = buildPayload({ descriptor } as FormSpec, data) as Record<string, unknown>;
  if (data.type) payload.type = data.type;
  return payload;
}
