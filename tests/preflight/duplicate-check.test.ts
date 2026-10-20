/**
 * Préflight — bloc `duplicateCheck` des `config.costumForms` (détection de doublons à la création).
 *
 * Le zod du document vérifie ce qu'il peut voir SEUL (champs déclarés, slot ancré). Reste ce qui
 * dépend du SITE : la référence `search.from` doit résoudre une section de recherche de la même
 * config, sinon la détection ne cherche rien — sans erreur, sans log en production. Aucun autre
 * gate ne le voit : ni `config:validate`, ni la fixture `effective-config` (qui ne lit pas les
 * costumForms).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { buildDuplicateBaseParams, type DuplicateSiteConfig } from "@/modules/profil/lib/duplicateSearch";
import type { DuplicateCheckSpec } from "@/modules/profil/forms/entityModalSpec";

const ROOT = path.resolve(__dirname, "../..");

interface ConfigWithForms {
  pages?: unknown;
  costumForms?: Record<string, { duplicateCheck?: DuplicateCheckSpec }>;
}

const cases = fs
  .readdirSync(ROOT)
  .filter((f) => /^config\.prod.*\.json$/.test(f))
  .sort()
  .flatMap((file) => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as ConfigWithForms;
    return Object.entries(config.costumForms ?? {})
      .filter(([, doc]) => doc.duplicateCheck)
      .map(([id, doc]) => ({ file, id, check: doc.duplicateCheck as DuplicateCheckSpec, config: config as DuplicateSiteConfig }));
  });

describe("preflight — duplicateCheck (détection de doublons à la création)", () => {
  it("sentinelle d'énumération : au moins un formulaire du parc déclare duplicateCheck", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const { file, id, check, config } of cases) {
    it(`${file} · costumForms.${id} — le périmètre de recherche se résout`, () => {
      const baseParams = buildDuplicateBaseParams(check.search, config, check.fetchLimit);
      expect(
        baseParams,
        `search.from ${JSON.stringify(check.search.from)} ne désigne aucune section de recherche exploitable de ${file}`,
      ).not.toBeNull();
      expect(baseParams?.searchBy).toEqual(["name"]);
      // Un périmètre vide chercherait dans toute la base : il doit porter au moins un filtre ou une provenance.
      const bounded = Boolean(baseParams?.defaultFilters) || Boolean(baseParams?.sourceKey?.length) || Boolean(baseParams?.defaultTags?.length);
      expect(bounded, "périmètre non borné (ni filtre, ni provenance, ni tag)").toBe(true);
    });
  }
});
