/**
 * Payload de CRÉATION du POI STANDARD (org/projet/event/poi via `configs/addStandard`). Le câblage d'écriture
 * (groupe `address` + geo) vient désormais de SON PROPRE descripteur `addPoiWriteDescriptor` (`./addPoi.write`),
 * générique et autonome — PLUS d'emprunt au descripteur du costum equipements (l'ex-« pont »).
 *
 * `descriptor` est INJECTABLE (DI) : le poi standard utilise le défaut ; un costum peut passer le sien pour
 * comparer la parité (cf. `equipements-sportifs/spec.test` : buildAddPoiPayload(form, equipementsSportifsDescriptor)).
 */
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import type { FormValues, FormDescriptor } from "@/modules/formEngine";
import { addPoiWriteDescriptor } from "./addPoi.write"; // descripteur d'écriture + side-effects (address/geo)

/**
 * Form → payload de création POI (pipeline, omit-empty) : adresse imbriquée, geo coercé, champs typés. `type`
 * est réémis depuis `data` (le poi standard porte SON type, ex. "place", via le form ; il n'est pas un champ
 * du descripteur d'écriture).
 */
export function buildAddPoiPayload(data: FormValues, descriptor: FormDescriptor = addPoiWriteDescriptor): Record<string, unknown> {
  const payload = buildPayload({ descriptor } as FormSpec, data) as Record<string, unknown>;
  if (data.type) payload.type = data.type;
  return payload;
}
