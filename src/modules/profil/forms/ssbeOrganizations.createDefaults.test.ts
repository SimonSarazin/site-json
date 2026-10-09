/**
 * Onglet admin « Maisons Sport Santé » de SSBE : sa modale d'AJOUT est semée par `createDefaults`
 * (`config.prod.sport-sante-bien-etre.json`). Ces valeurs sont des valeurs de FORMULAIRE, injectées
 * sans passer par le `read` des champs : pour le `switch` `mss`, il faut un booléen. Une chaîne
 * `"true"` (la valeur SERVEUR) faisait échouer la validation Zod du champ, et « Suivant » ne faisait
 * rien, sans message (review de la MR `n-dev` → `main`, 24/09).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildZodSchema } from "@/modules/formEngine";
import { buildPayload } from "@/modules/formEngine/engine/entityForm";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";
import { specToConfig } from "./resolveModalSpec";
import { applyCreateDefaults } from "./createDefaults";
import type { EntityModalCtx } from "./entityModalSpec";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const config = JSON.parse(readFileSync(resolve(ROOT, "config.prod.sport-sante-bien-etre.json"), "utf8")) as unknown;

/** Toutes les sections de la config qui ouvrent ce formulaire avec des `createDefaults`. */
function sectionsSemees(node: unknown, acc: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  if (Array.isArray(node)) node.forEach((n) => sectionsSemees(n, acc));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.createDefaults && o.create === "add-sport-sante-bienetre-organizations") acc.push(o);
    Object.values(o).forEach((v) => sectionsSemees(v, acc));
  }
  return acc;
}

const { descriptor, spec } = loadCostumForm("sport-sante-bienetre-organizations");
const addCtx = { mode: "add", entity: null, parent: null, scope: undefined, me: null, carrier: null, costum: undefined } as unknown as EntityModalCtx;

describe("SSBE — création depuis un onglet admin semé par `createDefaults`", () => {
  const sections = sectionsSemees(config);

  it("l'onglet « Maisons Sport Santé » sème bien la modale d'ajout", () => {
    expect(sections.length).toBeGreaterThan(0);
  });

  it.each(sections.map((s) => [JSON.stringify(s.createDefaults), s] as const))(
    "createDefaults %s : aucune erreur de validation sur les champs semés, et `mss` part en \"true\"",
    (_label, section) => {
      const seed = section.createDefaults as Record<string, unknown>;
      const values = applyCreateDefaults(specToConfig(spec).buildDefaults(addCtx), seed, Object.keys(descriptor.fields));
      const r = buildZodSchema(descriptor).safeParse(values);
      const erreursSemees = r.success ? [] : r.error.issues.filter((i) => Object.keys(seed).includes(String(i.path[0])));
      expect(erreursSemees).toEqual([]);
      if ("mss" in seed) expect(buildPayload({ descriptor }, values).mss).toBe("true");
    },
  );
});
