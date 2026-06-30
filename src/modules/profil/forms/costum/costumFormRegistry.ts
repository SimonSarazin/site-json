/**
 * Registre RUNTIME des modales costum (table `id → EntityModalSpec`). C'est le SEAM du « costum dans la config
 * globale » : les costums TS (via leur `spec.ts`) ET ceux de `config.costumForms` passent par la MÊME voie
 * UNIQUE `registerCostumForm(schema)` (compile → garde des clés → enregistre descripteur + spec). Aucune
 * duplication de chemin → pas de divergence TS↔config.
 *
 * `ModalRegistry`/`EditModalRegistry` consultent cette table par `id` (clé `add-<id>`/`edit-<id>`) au lieu
 * d'imports codés en dur — ce qui permet d'ajouter une entité costum SANS entrée hardcodée.
 */
import type { EntityModalSpec } from "../entityModalSpec";
import type { FormDescriptor } from "@/modules/formEngine";
import { registerDescriptor } from "../specRegistries";
import { compileCostumSchema, type CostumFormSchema } from "./compileCostumSchema";
import { CostumFormSchemaZod } from "./costumFormSchema.zod";
import { assertCostumKeysRegistered } from "./assertKeysRegistered";

const costumSpecs = new Map<string, EntityModalSpec>();

/** Compile un document costum (DONNÉES) → descripteur (registre) + spec (table). VOIE UNIQUE (TS et config) :
 *  VALIDE la structure (zod) puis l'EXISTENCE des clés (garde) avant d'enregistrer → message clair si malformé. */
export function registerCostumForm(schema: CostumFormSchema): { descriptor: FormDescriptor; spec: EntityModalSpec } {
  const parsed = CostumFormSchemaZod.safeParse(schema);
  if (!parsed.success) {
    const id = (schema as { id?: unknown })?.id ?? "?";
    throw new Error(`[costumForms] document costum invalide (id=${String(id)}) : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  }
  const compiled = compileCostumSchema(schema);
  // Garde : toute clé citée (codecs/scope/payload/validate/slots…) doit être enregistrée → erreur claire au
  // load plutôt qu'un warn silencieux au rendu. Les clés génériques sont garanties par `sharedRegistrations`.
  assertCostumKeysRegistered(compiled.descriptor, compiled.spec);
  registerDescriptor(compiled.descriptor);
  costumSpecs.set(compiled.spec.id, compiled.spec);
  return compiled;
}

/** Spec d'une modale costum par id (ex. "equipements-sportifs"), ou undefined si non enregistrée. */
export function getCostumModalSpec(id: string): EntityModalSpec | undefined {
  return costumSpecs.get(id);
}

/** Ids costum enregistrés (debug / itération). */
export function listCostumFormIds(): string[] {
  return [...costumSpecs.keys()];
}
