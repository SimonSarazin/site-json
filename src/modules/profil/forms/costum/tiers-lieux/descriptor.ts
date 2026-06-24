/**
 * Descripteur tiers-lieu (costum navigatorDesTierslieux) — DÉRIVÉ du document fusionné `./schema`
 * (`compileCostumSchema(...).descriptor`). Plus de re-déclaration de champs : la SOURCE UNIQUE est `schema.ts`.
 * Consommé par `modules/formEngine` (RENDU GenericForm + READ/WRITE pipeline via les wrappers de `./fns`).
 *
 * LEAF (aucun import de `./fns` → pas de cycle ESM) : les transforms `tl:*`/`geo:*`/`address:read` sont
 * enregistrés au runtime par `./fns` ; le schéma ne référence que leurs CLÉS. L'import `../../validators`
 * (side-effect) enregistre la clé de validation cross-champ `addressComplete` référencée par le schéma.
 * Byte-parité figée par `compiled.byteparity.test`.
 */
import type { FormDescriptor } from "@/modules/formEngine";
import "../../validators"; // side-effect : enregistre "addressComplete" (validate cross-champ du schéma)
import { compileCostumSchema } from "../compileCostumSchema";
import { TIERS_LIEUX_SCHEMA } from "./schema";

export const tiersLieuxDescriptor: FormDescriptor = compileCostumSchema(TIERS_LIEUX_SCHEMA).descriptor;
