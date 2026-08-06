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
  schemaFn: z.string().optional(),
  cleanValues: FnRefZod.optional(),
  afterSubmit: z.string().optional(),
  mutation: z.object({ entityType: z.string() }).passthrough(),
}).passthrough();
