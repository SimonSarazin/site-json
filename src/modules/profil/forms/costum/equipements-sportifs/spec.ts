/**
 * `EntityModalSpec` du costum poi-équipement (equipementsSportifs974) — DÉRIVÉE du document fusionné `./schema`
 * (`compileCostumSchema(...).spec`). 100 % DONNÉES + CLÉS (aucune closure). Le code référencé par clé est
 * enregistré dans `./fns` : descripteur `equipements-sportifs`, scope `poi:scope`, defaults `poi:emptyDefaults`,
 * slots `parentInfo`/`poiDoublons`, `poi:dropEmptyUrls`, `image:profilUrl`, `poi:invalidate`. Payload = pipeline.
 */
import type { EntityModalSpec } from "../../entityModalSpec";
import { compileCostumSchema } from "../compileCostumSchema";
import { registerCostumModalSpec } from "../costumFormRegistry";
import { EQUIPEMENTS_SPORTIFS_SCHEMA } from "./schema";

export const equipementsSportifsSpec: EntityModalSpec = compileCostumSchema(EQUIPEMENTS_SPORTIFS_SCHEMA).spec;
registerCostumModalSpec(equipementsSportifsSpec); // table runtime (résolution par id, voie config-driven)
