/**
 * Préflight — chaque document de `config.costumForms` des configs de déploiement (`config.prod*.json`)
 * doit être POSABLE : structure (CostumFormSchemaZod) PUIS voie unique `registerCostumForm` à blanc
 * (zod → compile → assertCostumKeysRegistered) — exactement le chemin du boot client
 * (`registerCostumForms.ts`), donc un doc qui casse ici casserait la modale au runtime.
 *
 * La vérification des CLÉS de registre est possible ici (environnement node, sans boot client complet) :
 * `registerSpecFns` (sharedRegistrations + fns métier) est node-safe — il est déjà importé par les tests
 * unitaires existants (cf. `src/modules/profil/forms/costum/__fixtures__/configCostum.ts`), aucune
 * dépendance `window` (le chargement window-only vit dans `registerCostumForms.ts`, PAS importé ici).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import "@/modules/profil/forms/registerSpecFns"; // clés génériques + métier — comme au boot (EntityFormModal)
import { CostumFormSchemaZod } from "@/modules/profil/forms/costum/costumFormSchema.zod";
import { registerCostumForm } from "@/modules/profil/forms/costum/costumFormRegistry";
import type { CostumFormSchema } from "@/modules/profil/forms/costum/compileCostumSchema";

const ROOT = path.resolve(__dirname, "../..");

const withCostumForms = fs
  .readdirSync(ROOT)
  .filter((f) => /^config\.prod.*\.json$/.test(f))
  .sort()
  .map((file) => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as {
      costumForms?: Record<string, CostumFormSchema>;
    };
    return { file, costumForms: cfg.costumForms ?? {} };
  })
  .filter(({ costumForms }) => Object.keys(costumForms).length > 0);

describe("preflight — config.costumForms (configs de déploiement)", () => {
  it("sentinelle d'énumération : au moins une config prod porte des costumForms", () => {
    // Si le nommage/emplacement des configs change, ce test échoue au lieu de laisser la suite passer à vide.
    expect(withCostumForms.length).toBeGreaterThan(0);
  });

  for (const { file, costumForms } of withCostumForms) {
    describe(file, () => {
      for (const [key, doc] of Object.entries(costumForms)) {
        it(`costumForms.${key} — structure valide (CostumFormSchemaZod) et clé = doc.id`, () => {
          const parsed = CostumFormSchemaZod.safeParse(doc);
          const issues = parsed.success
            ? ""
            : parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ");
          expect(parsed.success, issues).toBe(true);
          expect(doc.id, "clé costumForms.<id> ≠ doc.id (le registre résout par doc.id)").toBe(key);
        });

        it(`costumForms.${key} — registerCostumForm à blanc (compile + clés de registre enregistrées)`, () => {
          expect(() => registerCostumForm(doc)).not.toThrow();
        });
      }
    });
  }
});
