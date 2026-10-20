import { describe, it, expect } from "vitest";
import {
  actionCreateFormSchema,
  contributionFormSchema,
} from "./schemaForm";

/**
 * Régression : le `milestoneId` d'un palier n'a AUCUN format garanti en prod
 *  - client  `generateMilestoneId()`                 → 24 chars hexa
 *  - backend `Answer::generateMilestonneFromDepense` → `uniqid()` PHP, 13 chars hexa
 *  - données legacy                                  → chaîne libre non-hexa
 *
 * Un `milestoneId: mongoIdSchema` (24 hexa strict) rejetait les deux derniers cas
 * et `react-hook-form` bloquait le submit SANS rien afficher (le champ
 * `milestoneId` n'a pas de rendu). D'où « impossible de créer une action sur le
 * 1er palier, rien ne se passe au clic ». Le schéma ne garde plus que « non vide » —
 * la vraie validation est `Project.hasMilestone()` + le backend.
 */

const CLIENT_MILESTONE_ID = "a1b2c3d4e5f6a1b2c3d4e5f6"; // 24 hex (generateMilestoneId)
const BACKEND_MILESTONE_ID = "5f3a1b2c4d5e6"; // 13 hex (PHP uniqid())
const BACKEND_MILESTONE_ID_ENTROPY = "5f3a1b2c4d5e6.a1b2c3d4"; // uniqid('', true)
const LEGACY_MILESTONE_ID = "w6BvkaCwsHoNLXovy"; // legacy non-hexa (données réelles)

const baseAction = {
  name: "Réaliser l'étude",
  credits: 0,
  status: "todo" as const,
  tags: [],
  contributors: [],
  startDate: "",
  endDate: "",
};

describe("actionCreateFormSchema — milestoneId (client vs backend)", () => {
  it("accepte un id client (24 hexa)", () => {
    const result = actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: CLIENT_MILESTONE_ID });
    expect(result.success).toBe(true);
  });

  it("accepte un id backend uniqid() (13 hexa)", () => {
    const result = actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: BACKEND_MILESTONE_ID });
    expect(result.success).toBe(true);
  });

  it("accepte un id backend uniqid('', true) (13 hexa . entropie)", () => {
    const result = actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: BACKEND_MILESTONE_ID_ENTROPY });
    expect(result.success).toBe(true);
  });

  it("accepte un id legacy non-hexa (données réelles)", () => {
    const result = actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: LEGACY_MILESTONE_ID });
    expect(result.success).toBe(true);
  });

  it("rejette seulement un milestoneId vide / blanc", () => {
    expect(actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: "" }).success).toBe(false);
    expect(actionCreateFormSchema.safeParse({ ...baseAction, milestoneId: "   " }).success).toBe(false);
  });
});

describe("contributionFormSchema — allocations.milestoneId", () => {
  const baseContribution = {
    projectId: "a1b2c3d4e5f6a1b2c3d4e5f6",
    totalAmount: 100,
    financerType: "citoyens" as const,
    financerId: "user-1",
    paymentMethod: "stripe" as const,
  };

  it("accepte une allocation sur un palier backend (13 hexa)", () => {
    const result = contributionFormSchema.safeParse({
      ...baseContribution,
      allocations: [{ milestoneId: BACKEND_MILESTONE_ID, amount: 100 }],
    });
    expect(result.success).toBe(true);
  });

  it("garde une validation stricte 24 hexa sur projectId", () => {
    const result = contributionFormSchema.safeParse({
      ...baseContribution,
      projectId: BACKEND_MILESTONE_ID,
      allocations: [{ milestoneId: CLIENT_MILESTONE_ID, amount: 100 }],
    });
    expect(result.success).toBe(false);
  });
});
