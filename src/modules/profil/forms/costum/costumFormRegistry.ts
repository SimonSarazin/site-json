/**
 * Registre RUNTIME des modales costum (table `id → EntityModalSpec`). C'est le SEAM du « costum dans la config
 * globale » : aujourd'hui les 2 costums TS s'y enregistrent (via leur `spec.ts`) ; demain un loader lira
 * `config.costumForms` (JSON) → `compileCostumSchema(json)` → `registerCostumForm(...)` ICI, sans toucher au code.
 *
 * `ModalRegistry`/`EditModalRegistry` peuvent consulter cette table par `id` (clé `add-<id>`/`edit-<id>`) au lieu
 * d'imports codés en dur — ce qui permet d'ajouter une entité costum SANS entrée hardcodée.
 */
import type { EntityModalSpec } from "../entityModalSpec";
import type { FormDescriptor } from "@/modules/formEngine";
import { registerDescriptor } from "../specRegistries";
import { compileCostumSchema, type CostumFormSchema } from "./compileCostumSchema";
import { CostumFormSchemaZod } from "./costumFormSchema.zod";

const costumSpecs = new Map<string, EntityModalSpec>();

/** Enregistre une spec déjà compilée (réutilisé par les `spec.ts` TS — pas de recompilation). */
export function registerCostumModalSpec(spec: EntityModalSpec): void {
  costumSpecs.set(spec.id, spec);
}

/** Compile un document costum (DONNÉES) → descripteur (registre) + spec (table). Voie du loader JSON (étape 2).
 *  VALIDE la structure essentielle (zod) avant compilation → message clair si un costum de config est malformé. */
export function registerCostumForm(schema: CostumFormSchema): { descriptor: FormDescriptor; spec: EntityModalSpec } {
  const parsed = CostumFormSchemaZod.safeParse(schema);
  if (!parsed.success) {
    const id = (schema as { id?: unknown })?.id ?? "?";
    throw new Error(`[costumForms] document costum invalide (id=${String(id)}) : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  }
  const compiled = compileCostumSchema(schema);
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
