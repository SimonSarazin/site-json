/**
 * `EntityModalSpec` du costum tiers-lieu (navigatorDesTierslieux) — DÉRIVÉE du document fusionné `./schema`
 * (`compileCostumSchema(...).spec`). 100 % DONNÉES + CLÉS. Code référencé par clé enregistré dans `./fns` :
 * descripteur `tiers-lieux`, scope `tl:scope` (slug porteur), defaults `tl:emptyDefaults`, payload `tl:payload`
 * (merge tags costum + extraData), `tl:invalidate`. `image:profilUrl` partagé (enregistré par equipements-sportifs/fns).
 */
import type { EntityModalSpec } from "../../entityModalSpec";
import { compileCostumSchema } from "../compileCostumSchema";
import { TIERS_LIEUX_SCHEMA } from "./schema";

export const tiersLieuxSpec: EntityModalSpec = compileCostumSchema(TIERS_LIEUX_SCHEMA).spec;
