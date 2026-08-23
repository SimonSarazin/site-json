import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * GARDE : tout `costumForm` du parc déclare `costumSlug` — la clé porte trois mécanismes qu'un
 * retrait casserait EN SILENCE (finding review MR 44) : le pin de schéma en ÉDITION
 * (`resolveModalSpec` → schemaCostumSlug), la découverte de l'e2e `costum-forms` (qui joue le
 * form via `entityBySlug(costumSlug)`), et la cohérence avec `scope` (whitelist d'écriture).
 * Les deux forms MSS ont chacun été livrés SANS elle avant que la convention soit posée.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("préflight costumForms.costumSlug", () => {
  it("chaque costumForm du parc déclare costumSlug (string non vide)", () => {
    const manquants: string[] = [];
    for (const fichier of readdirSync(ROOT).filter((f) => /^config\.prod\..+\.json$/.test(f)).sort()) {
      const cfg = JSON.parse(readFileSync(join(ROOT, fichier), "utf8")) as { costumForms?: Record<string, { costumSlug?: unknown }> };
      for (const [id, doc] of Object.entries(cfg.costumForms ?? {})) {
        if (typeof doc.costumSlug !== "string" || doc.costumSlug.length === 0) manquants.push(`${fichier}/${id}`);
      }
    }
    expect(manquants).toEqual([]);
  });
});
