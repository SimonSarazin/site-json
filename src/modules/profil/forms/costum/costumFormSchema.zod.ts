/**
 * zod PRAGMATIQUE de `CostumFormSchema` — valide la STRUCTURE ESSENTIELLE d'un document costum (surtout ceux
 * posés à la main dans `config.costumForms`) AVANT compilation, pour échouer avec un message clair plutôt qu'au
 * rendu. Volontairement TOLÉRANT (`.passthrough()` + champs détaillés non exhaustifs) : on attrape les erreurs
 * GROSSES (clé requise absente, `fields` pas un record, `widget` manquant, pas de `mutation`) sans dupliquer
 * tout le type TS. Le compilateur + les registres gèrent le reste. Appliqué par `registerCostumForm`.
 */
import { z } from "zod";

/** clé seule OU {fn, params} (cf. entityModalSpec.FnRef). */
const FnRefZod = z.union([
  z.string(),
  z.object({ fn: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
]);

/** Champ TERSE : seul `widget` est requis (le reste est dérivé/optionnel). */
const TerseFieldZod = z.object({ widget: z.string() }).passthrough();

const SerializeGroupZod = z.object({
  serverKey: z.string(),
  read: z.string(),
  write: z.string(),
  groupReadOnly: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const CostumFormSchemaZod = z.object({
  id: z.string(),
  entityType: z.string(),
  collection: z.string().optional(),
  icon: z.string().optional(),
  costumSlug: z.string().optional(),
  deriveDefaults: z.boolean().optional(),
  layout: z.object({ kind: z.string() }).passthrough(),
  serializeGroups: z.record(z.string(), SerializeGroupZod).optional(),
  validateFn: z.string().optional(),
  fieldPresets: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  sections: z.array(z.object({ id: z.string() }).passthrough()),
  fields: z.record(z.string(), TerseFieldZod),
  chrome: z.object({ title: z.object({ add: z.unknown(), edit: z.unknown() }) }).passthrough(),
  descriptorVariant: z.string().optional(),
  image: z.object({ field: z.string() }).passthrough().optional(),
  listsFromCarrier: z.boolean().optional(),
  scope: z.object({}).passthrough().optional(),
  defaultsBase: z.string().optional(),
  slots: z.record(z.string(), z.string()).optional(),
  schemaFn: z.string().optional(),
  cleanValues: FnRefZod.optional(),
  afterSubmit: z.string().optional(),
  mutation: z.object({ entityType: z.string() }).passthrough(),
}).passthrough();
