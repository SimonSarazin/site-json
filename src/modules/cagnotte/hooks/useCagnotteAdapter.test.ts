// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CAGNOTTE_TYPE_CONFIGS, type CagnotteTypeConfig, type FundingEnvelopeNormalizedData } from "../types";
import type { OrgProject } from "./useOrganizationProjectsWithAnswers";

// Utilisateur connecté `u1`, sans organisation admin. Sans API (défaut),
// l'adaptateur calcule et la réparation des dépenses orphelines (effet) reste
// inerte ; le bloc « réparation » ci-dessous en fournit une pour l'exercer.
const mocks = vi.hoisted(() => ({ api: null as unknown }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    api: mocks.api,
    me: { serverData: { id: "u1" }, getEntityType: () => "citoyens" },
  }),
}));
vi.mock("@/modules/cagnotte/hooks/useUserAdminOrganizations", () => {
  const aucune: never[] = [];
  return { useUserAdminOrganizations: () => aucune };
});
// Les écritures de la réparation (`entity.updateField` sous le capot) sont
// mockées : on observe l'orchestration, pas `actionMilestonePathUpdates`.
vi.mock("@/modules/cagnotte/lib/actionMilestonePathUpdates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/cagnotte/lib/actionMilestonePathUpdates")>()),
  appendProjectMilestone: vi.fn().mockResolvedValue(undefined),
  updateAnswerDepenseFields: vi.fn().mockResolvedValue(undefined),
}));

import { milestoneRepairKey, useCagnotteAdapter } from "./useCagnotteAdapter";
import { generateMilestoneId } from "../utils/idGeneration";
import { CAGNOTTE_QUERY_KEYS } from "../constants/queryKeys";
import { appendProjectMilestone, updateAnswerDepenseFields } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";
import { COMMUN_RAW_DEPENSES_QUERY_KEY } from "@/modules/aac/hooks/useCommunRawDepenses";

afterEach(() => {
  mocks.api = null;
  vi.clearAllMocks();
});

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

/**
 * Régression C7 (MR 53) : `depense.financer` peut arriver en objet keyé par id de
 * financeur (forme Mongo brute). Les gardes pré-MR (`Array.isArray`,
 * `!transactions.length`) avaient sauté au profit d'un `.map` direct — l'objet
 * faisait planter TOUT l'adaptateur, sur les deux branches (`project` et
 * `proposition`). Lecture attendue : `toArrayOrValues`, montants sommés.
 */
describe("useCagnotteAdapter — `depense.financer` en objet keyé par id", () => {
  /** Fabriques : `getUserFunding` enrichit les financeurs EN PLACE, on ne partage donc aucune fixture. */
  const financerObjet = () => ({
    u1: { id: "u1", name: "Alice", amount: 250 },
    u2: { id: "u2", name: "Bob", amount: 100 },
  });
  const financerTableau = () => Object.values(financerObjet());

  function enveloppe(depense: Record<string, unknown>, projectId?: string): FundingEnvelopeNormalizedData {
    return {
      rawEnvelope: {
        projects: [{ id: "answer-1", projectId, titre: "Mon commun", depenses: [depense] }],
        links: {},
      },
    } as unknown as FundingEnvelopeNormalizedData;
  }

  const projets = (): OrgProject[] =>
    [
      {
        id: "proj-1",
        name: "Projet du commun",
        answerId: "answer-1",
        milestones: [{ milestoneId: "m1", name: "Dev", price: 5000, status: "open", currentFunding: 42 }],
        cagnotteTotalAmount: 0,
        cagnotteTargetAmount: 5000,
        rawProject: {},
      },
    ] as unknown as OrgProject[];

  function renderAdapter(
    fundingEnvelope: FundingEnvelopeNormalizedData,
    allProjects: OrgProject[],
    config: CagnotteTypeConfig,
    selectedId: string,
  ) {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    return renderHook(() => useCagnotteAdapter(fundingEnvelope, allProjects, config, selectedId), { wrapper });
  }

  it("proposition : ne plante pas, somme les montants et retrouve la part de l'utilisateur", () => {
    const { result } = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1", financer: financerObjet() }),
      [],
      CAGNOTTE_TYPE_CONFIGS.aac,
      "answer-1",
    );
    const item = result.current.savedSelectedResource!.items[0];
    expect(item.currentFunding).toBe(350);
    expect(item.unpaidFunding).toBe(350);
    expect(item.allFunding.map((f) => f.id)).toEqual(["u1", "u2"]);
    // `u1` est l'utilisateur connecté (cf. mock `useCocolight`).
    expect(item.userPledge).toBe(250);
    expect(item.funding.map((f) => f.financerId)).toEqual(["u1"]);
  });

  it("projet : idem sur le palier apparié à la dépense", () => {
    const { result } = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1", financer: financerObjet() }, "proj-1"),
      projets(),
      CAGNOTTE_TYPE_CONFIGS.standard,
      "proj-1",
    );
    const item = result.current.savedSelectedResource!.items[0];
    expect(item.milestoneId).toBe("m1");
    expect(item.currentFunding).toBe(350);
    expect(item.allFunding).toHaveLength(2);
    expect(item.userPledge).toBe(250);
  });

  it("témoin : la forme tableau donne exactement les mêmes montants", () => {
    const proposition = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1", financer: financerTableau() }),
      [],
      CAGNOTTE_TYPE_CONFIGS.aac,
      "answer-1",
    ).result.current.savedSelectedResource!.items[0];
    expect(proposition.currentFunding).toBe(350);
    expect(proposition.userPledge).toBe(250);

    const projet = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1", financer: financerTableau() }, "proj-1"),
      projets(),
      CAGNOTTE_TYPE_CONFIGS.standard,
      "proj-1",
    ).result.current.savedSelectedResource!.items[0];
    expect(projet.currentFunding).toBe(350);
    expect(projet.userPledge).toBe(250);
  });

  it("sans financeur : 0 côté proposition, repli sur `currentFunding` du palier côté projet", () => {
    const proposition = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1" }),
      [],
      CAGNOTTE_TYPE_CONFIGS.aac,
      "answer-1",
    ).result.current.savedSelectedResource!.items[0];
    expect(proposition.currentFunding).toBe(0);
    expect(proposition.allFunding).toEqual([]);

    const projet = renderAdapter(
      enveloppe({ poste: "Dev", priceInt: 5000, milestone: "m1" }, "proj-1"),
      projets(),
      CAGNOTTE_TYPE_CONFIGS.standard,
      "proj-1",
    ).result.current.savedSelectedResource!.items[0];
    expect(projet.currentFunding).toBe(42);
    expect(projet.allFunding).toEqual([]);
  });
});

/**
 * B3 (review MR 53) : commun AVEC projet lié, dépense legacy sans `milestone`.
 * La réparation fabrique un id, l'écrit sur le projet ET sur
 * `depense[i].milestone`, puis n'invalidait QUE l'enveloppe. Or la fiche commun
 * relit `depense[]` par une SECONDE entrée de cache (`useCommunRawDepenses`,
 * staleTime 60 s) : elle servait encore la ligne sans `milestone`, l'item fusionné
 * par `buildItemsFromRawDepenses` restait sans id, et les quatre boutons de
 * « Besoins financiers » échouaient. La réparation doit invalider les DEUX caches.
 */
describe("useCagnotteAdapter — réparation d'une dépense orpheline (projet lié)", () => {
  /** Enveloppe d'un commun dont le projet lié ne porte PAS la dépense n° 0. */
  function enveloppeAvecProjetLie(answerId: string): FundingEnvelopeNormalizedData {
    return {
      rawEnvelope: {
        projects: [
          {
            id: answerId,
            projectId: "proj-1",
            titre: "Mon commun",
            project: { id: "proj-1", oceco: { milestones: [{ milestoneId: "m1" }] } },
            depenses: [{ poste: "Dépense legacy", priceInt: 100 }],
          },
        ],
        links: {},
      },
    } as unknown as FundingEnvelopeNormalizedData;
  }

  function renderAvecApi(answerId: string) {
    const projectEntity = { id: "proj-1" };
    const answerEntity = { id: answerId };
    mocks.api = {
      project: vi.fn().mockResolvedValue(projectEntity),
      answer: vi.fn().mockResolvedValue(answerEntity),
    };
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    renderHook(() => useCagnotteAdapter(enveloppeAvecProjetLie(answerId), [], CAGNOTTE_TYPE_CONFIGS.aac, answerId), {
      wrapper,
    });
    return { invalidate, projectEntity, answerEntity };
  }

  it("invalide aussi le cache brut des dépenses de la fiche commun, sous le préfixe de la réponse", async () => {
    // Identité de réponse propre à ce test : la garde `inFlightMilestoneRepairs`
    // est module-wide, une clé déjà vue ne relancerait pas la réparation.
    const { invalidate } = renderAvecApi("answer-b3-cache");

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, "answer-b3-cache"] });
    });
    // L'enveloppe l'était déjà : les deux, pas l'une à la place de l'autre.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX() });
  });

  it("n'invalide qu'APRÈS avoir écrit l'id sur le projet et sur la dépense visée", async () => {
    const { invalidate, projectEntity, answerEntity } = renderAvecApi("answer-b3-ordre");

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [COMMUN_RAW_DEPENSES_QUERY_KEY, "answer-b3-ordre"] });
    });

    expect(appendProjectMilestone).toHaveBeenCalledWith(
      expect.objectContaining({
        project: projectEntity,
        milestone: expect.objectContaining({ name: "Dépense legacy", status: "open" }),
      }),
    );
    const generatedId = vi.mocked(appendProjectMilestone).mock.calls[0][0].milestone.milestoneId;
    expect(generatedId).toBeTruthy();
    expect(updateAnswerDepenseFields).toHaveBeenCalledWith({
      answer: answerEntity,
      index: 0,
      fields: { milestone: generatedId },
    });
    // Sinon le refetch relirait encore la ligne d'avant.
    expect(vi.mocked(updateAnswerDepenseFields).mock.invocationCallOrder[0]).toBeLessThan(
      invalidate.mock.invocationCallOrder[0],
    );
  });
});
