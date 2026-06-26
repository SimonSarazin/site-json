/**
 * Enregistrement du costum tiers-lieu (navigatorDesTierslieux) dans la table runtime, via la VOIE UNIQUE
 * `registerCostumForm(SCHEMA)` — la MÊME que celle d'un costum posé en `config.costumForms` :
 *   compile (`compileCostumSchema`) → garde des clés (`assertCostumKeysRegistered`) → enregistre le DESCRIPTEUR
 *   (par id) ET la SPEC. `fns.ts` ne fait QUE déclarer les clés de code (tl:scope / tl:emptyDefaults / tl:payload
 *   / tl:years / tl:video* / tl:numOrUndef) que le schéma référence.
 *
 * `import "./fns"` EN PREMIER : enregistre ces clés pour que la garde de `registerCostumForm` les trouve.
 */
import "../sharedRegistrations"; // clés GÉNÉRIQUES (codecs/coercions/geo/validators…) — dont addressComplete (validateFn du schéma)
import "./fns"; // clés MÉTIER (tl:scope/tl:payload/tl:emptyDefaults/tl:years/tl:video*)
import type { EntityModalSpec } from "../../entityModalSpec";
import { registerCostumForm } from "../costumFormRegistry";
import { TIERS_LIEUX_SCHEMA } from "./schema";

export const tiersLieuxSpec: EntityModalSpec = registerCostumForm(TIERS_LIEUX_SCHEMA).spec;
