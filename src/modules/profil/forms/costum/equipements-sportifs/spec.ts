/**
 * Enregistrement du costum poi-équipement (equipementsSportifs974) dans la table runtime, via la VOIE UNIQUE
 * `registerCostumForm(SCHEMA)` — la MÊME que celle d'un costum posé en `config.costumForms` :
 *   compile (`compileCostumSchema`) → garde des clés (`assertCostumKeysRegistered`) → enregistre le DESCRIPTEUR
 *   (par id) ET la SPEC. Plus de duplication : `fns.ts` ne fait QUE déclarer les clés de code (scope/defaults/
 *   slots) que le schéma référence ; `descriptor.ts`/`spec.ts` ne sont plus que des dérivations pures (tests).
 *
 * `import "./fns"` EN PREMIER : enregistre les clés de code (poi:scope / poi:emptyDefaults / parentInfo /
 * poiDoublons) pour que la garde de `registerCostumForm` les trouve.
 */
import "../sharedRegistrations"; // clés GÉNÉRIQUES (codecs/coercions/geo/validators/image:profilUrl/cleanValues/invalidate)
import "./fns"; // clés MÉTIER (poi:scope/poi:emptyDefaults/parentInfo/poiDoublons)
import type { EntityModalSpec } from "../../entityModalSpec";
import { registerCostumForm } from "../costumFormRegistry";
import { EQUIPEMENTS_SPORTIFS_SCHEMA } from "./schema";

export const equipementsSportifsSpec: EntityModalSpec = registerCostumForm(EQUIPEMENTS_SPORTIFS_SCHEMA).spec;
