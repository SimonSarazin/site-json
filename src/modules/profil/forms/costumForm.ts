/**
 * Génération RUNTIME (prod) d'une `JsonFormConfig` costum depuis la lib distribuée — voie B, P-D de
 * doc/formulaire-config-driven.md. Ouvre le scope (`me.costum(slug)`, charge le module lazy enrichi),
 * décrit le form (`describeForm`), puis applique le cœur `descriptorToConfig`. AUCUNE dépendance à
 * l'artefact build-time `costum-extensions.json` → fonctionne en production.
 */
import type { Collection, CostumFormDescriptor, KnownCostumSlug } from "@communecter/cocolight-api-client";
import { descriptorToConfig, type JsonFormConfig } from "@/modules/formEngine";

/** Surface minimale de `me` requise : ouvrir un scope costum exposant `describeForm`. */
interface CostumScopeLike {
  describeForm(collection: Collection): CostumFormDescriptor | null;
}
export interface CostumCapableMe {
  costum(slug: KnownCostumSlug): Promise<CostumScopeLike>;
}

/**
 * Construit la config d'un form costum/collection depuis le runtime lib. Retourne `null` si la
 * collection n'est pas couverte par le costum (ou non créable via form). Le résultat se branche
 * directement sur `JsonFormHost` (configToDescriptor → GenericForm → runSubmit).
 */
export async function costumFormConfig(
  me: CostumCapableMe,
  slug: KnownCostumSlug,
  collection: Collection,
): Promise<JsonFormConfig | null> {
  const scope = await me.costum(slug);
  const desc = scope.describeForm(collection);
  return desc ? descriptorToConfig(desc) : null;
}
