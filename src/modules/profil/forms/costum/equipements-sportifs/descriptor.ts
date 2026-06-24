/**
 * Descripteur POI équipement (costum equipementsSportifs974) — DÉRIVÉ du document fusionné `./schema`
 * (`compileCostumSchema(...).descriptor`). Plus de re-déclaration de champs : la SOURCE UNIQUE est `schema.ts`
 * (widget-driven → type/read/default dérivés). Consommé par le moteur générique `modules/formEngine` :
 *  - RENDU : widgets + sections (wizard) + conditionnel + computed (GenericForm) ;
 *  - READ/WRITE : `read`/`write`/`default`/`group` par champ + `serializeGroups.address`, exécutés par le
 *    pipeline (seedEntity/buildPayload/buildEditPayload via POI_SPEC dans `./fns`).
 *
 * LEAF (aucun import de `./fns` → pas de cycle ESM) : les transforms `poi:*`/`geo:*`/`address:read` sont
 * enregistrés au runtime par `./fns` (qui importe CE descripteur pour POI_SPEC) ; le schéma ne référence que
 * leurs CLÉS string. Byte-parité figée par `compiled.byteparity.test`. cf. doc/moteur-formulaire-generique.md.
 */
import type { FormDescriptor } from "@/modules/formEngine";
import { compileCostumSchema } from "../compileCostumSchema";
import { EQUIPEMENTS_SPORTIFS_SCHEMA } from "./schema";

export const equipementsSportifsDescriptor: FormDescriptor = compileCostumSchema(EQUIPEMENTS_SPORTIFS_SCHEMA).descriptor;
