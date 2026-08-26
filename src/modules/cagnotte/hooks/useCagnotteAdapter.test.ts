import { describe, it, expect } from "vitest";
import { milestoneRepairKey } from "./useCagnotteAdapter";
import { generateMilestoneId } from "../utils/idGeneration";

/**
 * Régression : boucle de requêtes infinie à l'ouverture du formulaire de dépôt
 * d'un commun (`findanswered` → `updatepathvalue` → `fundingenvelope` → …).
 *
 * Cause : la garde d'idempotence de la réparation des dépenses orphelines
 * incluait le `milestoneId`. Or quand la dépense n'en a pas, celui-ci est
 * FABRIQUÉ par `generateMilestoneId` (`Date.now()` + `Math.random()`) à chaque
 * recalcul du memo. La clé était donc neuve à chaque tour, la garde inopérante :
 * la réparation réécrivait, invalidait l'enveloppe, relançait le memo — et
 * créait au passage un milestone de rebut sur le projet à CHAQUE itération.
 */
describe("milestoneRepairKey", () => {
  it("ne dépend QUE de l'identité stable de la dépense", () => {
    const a = milestoneRepairKey({ answerId: "ans1", depenseIndex: 0 });
    const b = milestoneRepairKey({ answerId: "ans1", depenseIndex: 0 });
    expect(a).toBe(b);
  });

  it("survit à un identifiant de milestone régénéré — le cœur du bug", () => {
    // Deux passages du memo sur la MÊME dépense produisent deux ids différents.
    const id1 = generateMilestoneId();
    const id2 = generateMilestoneId([id1]);
    expect(id1).not.toBe(id2);

    // La clé, elle, doit rester identique : sinon la garde ne matche jamais.
    const repair = { answerId: "ans1", depenseIndex: 2 };
    expect(milestoneRepairKey({ ...repair, milestoneId: id1 } as never)).toBe(
      milestoneRepairKey({ ...repair, milestoneId: id2 } as never)
    );
  });

  it("distingue deux dépenses de la même réponse", () => {
    expect(milestoneRepairKey({ answerId: "ans1", depenseIndex: 0 })).not.toBe(
      milestoneRepairKey({ answerId: "ans1", depenseIndex: 1 })
    );
  });

  it("distingue la même position dans deux réponses", () => {
    expect(milestoneRepairKey({ answerId: "ans1", depenseIndex: 0 })).not.toBe(
      milestoneRepairKey({ answerId: "ans2", depenseIndex: 0 })
    );
  });
});

describe("generateMilestoneId — pourquoi il ne peut PAS servir de clé de garde", () => {
  it("rend une valeur différente à chaque appel, même sans collision déclarée", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateMilestoneId()));
    // Si ces valeurs étaient stables, la clé d'origine aurait fonctionné.
    expect(ids.size).toBeGreaterThan(1);
  });

  it("évite les identifiants déjà pris", () => {
    const pris = generateMilestoneId();
    expect(generateMilestoneId([pris])).not.toBe(pris);
  });
});
