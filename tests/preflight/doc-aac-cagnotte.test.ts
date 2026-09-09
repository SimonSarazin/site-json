import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { EntityTypes, Organization, User } from "@communecter/cocolight-api-client";
import { calculateCagnottePermissions } from "@/modules/cagnotte/permissions/calculators/cagnotte";

/**
 * Anti-dérive de la doc de référence des modules AAC / cagnotte (doc/18, doc/34,
 * doc/README, doc-projets/federation-des-cae) sur les points où la review de la
 * MR 53 l'a trouvée en contradiction avec le code (H29, M47, M48, M49). Chaque
 * assertion est ancrée sur un FAIT de code (un calculateur, un parseur, une
 * table de mapping) puis vérifie que la phrase de la doc dit la même chose :
 * un commit qui change la règle casse ce test → mettre à jour la doc, pas le test.
 * (Même discipline que skill-integrity.test.ts pour la skill config-assistant.)
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

/** Ligne de table markdown dont la 1ʳᵉ cellule est `\`${cell}\``. */
function tableRow(doc: string, cell: string): string {
  const line = doc.split("\n").find((l) => l.startsWith(`| \`${cell}\` |`));
  expect(line, `ligne de table \`${cell}\` introuvable`).toBeDefined();
  return line as string;
}

function makeOrgEntity(isAdmin = false): EntityTypes {
  return {
    getEntityType: () => "organizations",
    isAdmin: () => isAdmin,
    isContributor: () => false,
  } as unknown as Organization;
}

function makeMe(id: string): User {
  return { id, isConnected: true } as unknown as User;
}

describe("doc/18-module-cagnotte ⇄ calculateurs (anti-dérive)", () => {
  it("H29 — canDeleteAction : l'auteur d'une action `todo` peut la supprimer, et le tableau des permissions le dit", () => {
    const auteur = calculateCagnottePermissions(makeOrgEntity(false), makeMe("auteur"));
    expect(auteur.canDeleteAction({ status: "todo", authorId: "auteur", contributorIds: [] })).toBe(true);
    expect(auteur.canDeleteAction({ status: "done", authorId: "auteur", contributorIds: [] })).toBe(false);
    // Un contributeur assigné, non : supprimer est plus fort que corriger.
    const assigne = calculateCagnottePermissions(makeOrgEntity(false), makeMe("assigne"));
    expect(assigne.canDeleteAction({ status: "todo", authorId: "auteur", contributorIds: ["assigne"] })).toBe(false);

    const row = tableRow(read("doc/18-module-cagnotte.md"), "canDeleteAction(a)");
    expect(row).toMatch(/auteur/);
    expect(row).toMatch(/done/);
    expect(row).not.toMatch(/ignoré|admin uniquement \(signature/);
  });
});
