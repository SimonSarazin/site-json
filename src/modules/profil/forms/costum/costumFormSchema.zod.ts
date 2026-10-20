/**
 * zod PRAGMATIQUE de `CostumFormSchema` — valide la STRUCTURE ESSENTIELLE d'un document costum (surtout ceux
 * posés à la main dans `config.costumForms`) AVANT compilation, pour échouer avec un message clair plutôt qu'au
 * rendu. Volontairement TOLÉRANT (`.passthrough()` + champs détaillés non exhaustifs) : on attrape les erreurs
 * GROSSES (clé requise absente, `fields` pas un record, `widget` manquant, pas de `mutation`) sans dupliquer
 * tout le type TS. Le compilateur + les registres gèrent le reste. Appliqué par `registerCostumForm`.
 */
import { z } from "zod";

import { SearchTypeSchema } from "@/modules/search/schema";

/** clé seule OU {fn, params} (cf. entityModalSpec.FnRef). */
const FnRefZod = z.union([
  z.string(),
  z.object({ fn: z.string(), params: z.record(z.string(), z.unknown()).optional() }),
]);

/** Clé de registre du slot générique « doublons à la création » (cf. costum/sharedFns.ts). */
const DUPLICATES_SLOT_KEY = "slot:entityDuplicates";

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string");

/** Entrées (`champ` ou `"$slot:<id>"`) placées par une section, format `groups` ou à plat. */
function sectionEntries(section: Record<string, unknown>): string[] {
  const flat = isStringArray(section.fields) ? section.fields : [];
  const groups = Array.isArray(section.groups) ? section.groups : [];
  const grouped = groups.flatMap((g: unknown) => {
    const fields = g && typeof g === "object" && "fields" in g ? g.fields : undefined;
    return isStringArray(fields) ? fields : [];
  });
  return [...flat, ...grouped];
}

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
  /**
   * SOUS-TYPE canonique de ce form DANS son costum — la clé du `typeObj` quand le costum en a un
   * (`financement`, `recoveryCenter`…), jamais l'`id` du form (nom local de config, renommable,
   * inconnu du legacy). C'est la valeur écrite dans `reference.costumTypes.<slug>` au référencement
   * d'une entité, et la clé que `costumSubType` (baseParams) et les routes `editModals` consomment.
   */
  subType: z.string().optional(),
  /** Libellé du sous-type dans le sélecteur de référencement (LocalizedString ou clé i18n). */
  subTypeLabel: z.unknown().optional(),
  /**
   * Comment un NATIF de ce form se reconnaît en base — même grammaire qu'`editModalMatch` (égalité
   * plate champ→valeur, `contains` implicite sur tableau, chemins pointés). Le discriminant n'est
   * PAS câblé sur `type` : `{"category": …}`, `{"mainTag": …}` ou un champ costum conviennent.
   * ABSENT = form par défaut de sa collection (précédent : le form organizations « générique » de
   * sport-sante, sans inject). Sert à l'expansion de `costumSubType` (branche native) et à la
   * pré-sélection du sélecteur de référencement — jamais à ÉCRIRE ces champs.
   */
  identity: z.record(z.string(), z.unknown()).optional(),
  deriveDefaults: z.boolean().optional(),
  layout: z.object({ kind: z.string() }).passthrough(),
  serializeGroups: z.record(z.string(), SerializeGroupZod).optional(),
  validateFn: z.string().optional(),
  fieldPresets: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  sections: z.array(z.object({ id: z.string() }).passthrough()),
  fields: z.record(z.string(), TerseFieldZod),
  chrome: z.object({
    title: z.object({ add: z.unknown(), edit: z.unknown() }),
    // Textes de l'invite de connexion affichée à la place du formulaire pour un
    // visiteur non connecté (cf. `DynamicModal`). Chaque clé : clé i18n OU
    // `LocalizedString` inline ; absente → traduction `AuthRequired.*` par défaut.
    authPrompt: z.object({ title: z.unknown(), description: z.unknown() }).partial().optional(),
  }).passthrough(),
  descriptorVariant: z.string().optional(),
  image: z.object({ field: z.string() }).passthrough().optional(),
  listsFromCarrier: z.boolean().optional(),
  scope: z.object({}).passthrough().optional(),
  defaultsBase: z.string().optional(),
  slots: z.record(z.string(), z.string()).optional(),
  /**
   * Détection de doublons à la création (cf. `DuplicateCheckSpec`, entityModalSpec.ts). STRICT : le
   * bloc est lu par deux consommateurs, une clé mal orthographiée (`confirmOnSumbit`) serait ignorée
   * en silence et désarmerait la confirmation sans que rien ne le dise.
   */
  duplicateCheck: z.object({
    nameField: z.string().min(1),
    postalCodeField: z.string().min(1).optional(),
    minChars: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).optional(),
    fetchLimit: z.number().int().min(1).optional(),
    confirmOnSubmit: z.boolean().optional(),
    detailsMode: z.enum(["dialog", "drawer"]).optional(),
    search: z.object({
      types: z.array(SearchTypeSchema).min(1),
      from: z.object({ page: z.string().min(1), sectionId: z.string().min(1) }).strict().optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
      notSourceKey: z.boolean().optional(),
      sourceKey: z.array(z.string()).optional(),
    }).strict(),
  }).strict().optional(),
  schemaFn: z.string().optional(),
  cleanValues: FnRefZod.optional(),
  afterSubmit: z.string().optional(),
  mutation: z.object({
    entityType: z.string(),
    /**
     * STAMPS déclaratifs (cf. `SpecStamp`, entityModalSpec.ts) : valeurs calculées posées par la
     * mutation. Validé ici pour échouer avec un message clair sur une grammaire malformée (le
     * passthrough du bloc laisserait passer n'importe quoi jusqu'au runtime).
     */
    stamps: z.array(z.object({
      field: z.string().min(1),
      value: z.unknown(),
      op: z.enum(["set", "fillIfEmpty", "append"]).optional(),
      on: z.enum(["add", "edit", "both"]).optional(),
      channel: z.enum(["payload", "pathValue"]).optional(),
    }).strict()).optional(),
  }).passthrough(),
}).passthrough().superRefine((doc, ctx) => {
  // COHÉRENCE de `duplicateCheck` avec le reste du document. Le `.strict()` du bloc n'attrape que
  // l'orthographe des CLÉS ; une VALEUR fausse (champ inexistant, slot jamais ancré) laisse le
  // document valide et la détection muette, sans aucun signal — exactement ce que le bloc veut éviter.
  const check = doc.duplicateCheck;
  if (!check) return;
  const issue = (path: string[], message: string) => ctx.addIssue({ code: "custom", path: ["duplicateCheck", ...path], message });

  for (const key of ["nameField", "postalCodeField"] as const) {
    const field = check[key];
    if (field && !(field in doc.fields)) issue([key], `« ${field} » n'est pas un champ déclaré dans \`fields\``);
  }
  if (check.confirmOnSubmit && !check.postalCodeField) {
    issue(["confirmOnSubmit"], "exige `postalCodeField` : la confirmation porte sur « même nom ET même code postal »");
  }

  const slotIds = Object.entries(doc.slots ?? {}).filter(([, key]) => key === DUPLICATES_SLOT_KEY).map(([id]) => id);
  if (slotIds.length === 0 && !check.confirmOnSubmit) {
    issue([], `bloc sans effet : ni slot \`${DUPLICATES_SLOT_KEY}\` déclaré dans \`slots\`, ni \`confirmOnSubmit\``);
  }
  const anchored = new Set(doc.sections.flatMap(sectionEntries).filter((f) => f.startsWith("$slot:")).map((f) => f.slice("$slot:".length)));
  for (const id of slotIds) {
    if (!anchored.has(id)) issue([], `slot « ${id} » déclaré mais ancré dans aucune section (\`"$slot:${id}"\`) : l'alerte ne s'affichera jamais`);
  }
});
