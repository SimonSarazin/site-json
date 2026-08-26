/**
 * TEST-SUPPORT (PAS un fichier de test) — charge un document costum depuis le VRAI fichier de config de
 * déploiement (`config.prod.*.json`), c.-à-d. la SOURCE « config fait foi », et le compile via la voie UNIQUE
 * `registerCostumForm` (la même qu'au runtime). Remplace les ex-`<costum>/{schema,descriptor,spec}.ts` TS
 * (supprimés : ils DUPLIQUAIENT la config). Les clés de code (fns) sont garanties par l'import de
 * `registerSpecFns` (exactement comme au boot via EntityFormModal).
 *
 * Au runtime ces documents arrivent par `window.__CONFIG__.costumForms` (cf. registerCostumForms.ts) ; en test
 * on les lit directement depuis le fichier de config — aucune duplication de la donnée en TS.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "../../registerSpecFns"; // enregistre TOUTES les clés (sharedRegistrations + costum fns) — comme au runtime
import { registerCostumForm } from "../costumFormRegistry";
import type { CostumFormSchema } from "../compileCostumSchema";
import type { EntityModalSpec } from "../../entityModalSpec";
import type { FormDescriptor } from "@/modules/formEngine";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../.."); // → racine du projet site-json
const CONFIG_FILE: Record<string, string> = {
  "equipements-sportifs": "config.prod.equipements-Sportifs.json",
  "tiers-lieux": "config.prod.tiers-lieux.json",
  "institut-bleu-acteur": "config.prod.institut-bleu.json",
  "structure": "config.prod.maison-sport-sante-la-tampon.json",
  "actualite": "config.prod.maison-sport-sante-la-tampon.json",
};

/** Document costum BRUT (JSON config), tel que servi au runtime via `window.__CONFIG__.costumForms`. */
export function costumDoc(id: string): CostumFormSchema {
  const file = CONFIG_FILE[id];
  if (!file) throw new Error(`[test] pas de config.prod connu pour le costum "${id}"`);
  const cfg = JSON.parse(readFileSync(resolve(ROOT, file), "utf8")) as { costumForms?: Record<string, CostumFormSchema> };
  const doc = cfg.costumForms?.[id];
  if (!doc) throw new Error(`[test] costumForms.${id} absent de ${file}`);
  return doc;
}

/** Compile le document JSON via la voie unique `registerCostumForm` → { descriptor, spec }. */
export function loadCostumForm(id: string): { descriptor: FormDescriptor; spec: EntityModalSpec } {
  return registerCostumForm(costumDoc(id));
}
