import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { EntityTypes, Organization, User } from "@communecter/cocolight-api-client";
import { calculateCagnottePermissions } from "@/modules/cagnotte/permissions/calculators/cagnotte";
import { resolveCommunOwnerIds } from "@/modules/aac/lib/objectiveHelpers";
import { parseFieldPath } from "@/modules/aac/lib/resolveAacCardFields";

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

/** L'item de liste markdown (`- …` + ses lignes de continuation indentées) qui contient `needle`. */
function bulletContaining(doc: string, needle: string): string {
  const lines = doc.split("\n");
  const at = lines.findIndex((l) => l.includes(needle));
  expect(at, `« ${needle} » introuvable`).toBeGreaterThan(-1);
  let start = at;
  while (start > 0 && !lines[start].startsWith("- ")) start--;
  let end = at + 1;
  while (end < lines.length && lines[end].startsWith("  ")) end++;
  return lines.slice(start, end).join("\n");
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

describe("doc-projets/federation-des-cae ⇄ module AAC (anti-dérive)", () => {
  it("M47 — `ownerIds` d'un commun = le déposant seul, jamais l'admin de l'appel", () => {
    // `resolveCommunOwnerIds` ne pousse que l'auteur de la réponse : l'admin de
    // l'appel obtient les paliers par l'entité du projet lié, pas par cette liste
    // (doc/34 §6, doc/18 §Pièges n°4). Une doc qui dit « déposant + admin de
    // l'appel » invite à élargir les droits d'écriture sur le plan de financement
    // de n'importe quel commun déposé par un tiers.
    const answer = { userId: "deposant" } as Parameters<typeof resolveCommunOwnerIds>[0];
    expect(resolveCommunOwnerIds(answer)).toEqual(["deposant"]);

    const doc = read("doc-projets/federation-des-cae.md");
    expect(doc).not.toMatch(/déposant \+ admin de l'appel/);
    expect(doc).toMatch(/`ownerIds` \(le déposant seul/);
  });
});

describe("doc/34-module-aac ⇄ lib (anti-dérive)", () => {
  it("M48 — §3.1 : `aapStep1.q_x` est accepté comme chemin RACINE (source \"config\"), seul `answers.*` mal formé rend null", () => {
    // Le premier segment n'étant pas `answers`, la valeur est lue telle quelle à la
    // racine du document — elle n'est PAS rejetée, et rien ne retombe sur le scan.
    expect(parseFieldPath("aapStep1.q_x")).toEqual({ stepKey: null, id: "aapStep1.q_x" });
    expect(parseFieldPath("answers.q_x")).toBeNull();
    expect(parseFieldPath("answers.a.b.c")).toBeNull();

    const bullet = bulletContaining(read("doc/34-module-aac.md"), "`aapStep1.q_x`");
    expect(bullet).toMatch(/racine/i);
    expect(bullet).toMatch(/"config"/);
    expect(bullet).not.toMatch(/rend `null`/);
  });
});
