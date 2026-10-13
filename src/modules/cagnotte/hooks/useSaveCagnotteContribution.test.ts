// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici :
 *  - une promesse s'arrête à `addFinancer` — pas de versement fantôme ;
 *  - un échec ne rapporte jamais un succès ;
 *  - `saveCoformAnswer` n'est jamais appelé : ce chemin réécrit `answers` en entier.
 */

const mocks = vi.hoisted(() => ({
  api: null as unknown,
  me: { serverData: { id: "u1" } } as unknown,
}));

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: mocks.api, me: mocks.me }),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
vi.mock("@/hooks/useT", () => ({ useT: () => (cle: string) => cle }));
vi.mock("@/lib/confetti", () => ({ launchConfettiBurst: vi.fn() }));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/toastUtils", () => ({
  showSuccessToast: toasts.success,
  showErrorToast: toasts.error,
}));

import { useSaveCagnotteContribution } from "./useSaveCagnotteContribution";

const FINKEY = "a-w171hEa1bvz9";
const FINANCER = { id: "u1", name: "Alice", type: "citoyens" };

type Espions = {
  addFinancer: ReturnType<typeof vi.fn>;
  payFinancer: ReturnType<typeof vi.fn>;
  saveCoformAnswer: ReturnType<typeof vi.fn>;
};

/** Monte le hook avec une Answer espionnée ; `over` permet de simuler un échec. */
function monter(over: Partial<Espions> = {}) {
  const espions: Espions = {
    addFinancer: vi.fn(async () => ({ depenseKey: "0", finkey: FINKEY, finIndex: 0 })),
    payFinancer: vi.fn(async () => ({ invoiceId: "FIN-1", confirmation: "pending" as const })),
    saveCoformAnswer: vi.fn(),
    ...over,
  };

  const answer = { id: "ans1", addFinancer: espions.addFinancer, payFinancer: espions.payFinancer };
  mocks.api = {
    answer: vi.fn(async () => answer),
    endpointApi: { saveCoformAnswer: espions.saveCoformAnswer },
  };

  const { result } = renderHook(() => useSaveCagnotteContribution());
  return { ...result.current, espions };
}

afterEach(() => {
  mocks.api = null;
  mocks.me = { serverData: { id: "u1" } };
  vi.clearAllMocks();
});

describe("saveContribution — promesse (sans moyen de paiement)", () => {
  it("crée l'engagement et n'enregistre AUCUN versement", async () => {
    const { saveContribution, espions } = monter();

    const ok = await saveContribution("ans1", [{ depenseIndex: 0, amount: 1000, milestoneId: "m1" }], FINANCER);

    expect(ok).toBe(true);
    expect(espions.addFinancer).toHaveBeenCalledWith({ milestoneId: "m1", financerId: "u1", amount: 1000 });
    // Une promesse laisse `payment.logs` vide côté serveur : c'est le canonique.
    expect(espions.payFinancer).not.toHaveBeenCalled();
  });

  it("vise la dépense par `milestoneId` quand il existe, sinon par clé", async () => {
    const { saveContribution, espions } = monter();

    await saveContribution("ans1", [
      { depenseIndex: 0, amount: 10, milestoneId: "m1" },
      { depenseIndex: 3, amount: 20 },
      { depenseIndex: 9, amount: 30, depenseKey: "7" },
    ], FINANCER);

    expect(espions.addFinancer.mock.calls[0][0]).toMatchObject({ milestoneId: "m1" });
    // Sans jalon ni clé explicite, repli sur la position — exact tant que
    // `depense` est un vrai tableau.
    expect(espions.addFinancer.mock.calls[1][0]).toMatchObject({ depenseKey: "3" });
    // Une clé explicite prime toujours sur la position.
    expect(espions.addFinancer.mock.calls[2][0]).toMatchObject({ depenseKey: "7" });
  });

  it("n'envoie ni nom ni type du financeur : le serveur les résout", async () => {
    const { saveContribution, espions } = monter();

    await saveContribution("ans1", [{ depenseIndex: 0, amount: 10, milestoneId: "m1" }], FINANCER);

    const payload = espions.addFinancer.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("type");
  });

  it("ignore les allocations à zéro", async () => {
    const { saveContribution, espions } = monter();

    await saveContribution("ans1", [
      { depenseIndex: 0, amount: 0, milestoneId: "m1" },
      { depenseIndex: 1, amount: 50, milestoneId: "m2" },
    ], FINANCER);

    expect(espions.addFinancer).toHaveBeenCalledTimes(1);
  });
});

describe("saveContribution — échecs", () => {
  it("rend `false` quand toutes les dépenses échouent", async () => {
    const { saveContribution } = monter({
      addFinancer: vi.fn(async () => { throw new Error("not allowed"); }),
    });

    const ok = await saveContribution("ans1", [{ depenseIndex: 0, amount: 10, milestoneId: "m1" }], FINANCER);

    expect(ok).toBe(false);
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("rend `true` en succès partiel, mais signale l'échec", async () => {
    const addFinancer = vi.fn()
      .mockResolvedValueOnce({ depenseKey: "0", finkey: FINKEY })
      .mockRejectedValueOnce(new Error("depense not found"));
    const { saveContribution } = monter({ addFinancer });

    const ok = await saveContribution("ans1", [
      { depenseIndex: 0, amount: 10, milestoneId: "m1" },
      { depenseIndex: 1, amount: 20, milestoneId: "m2" },
    ], FINANCER);

    expect(ok).toBe(true);
    expect(toasts.error).toHaveBeenCalled();
  });

  it("refuse sans allocation, sans financeur, ou hors session", async () => {
    const { saveContribution, espions } = monter();
    await expect(saveContribution("ans1", [], FINANCER)).resolves.toBe(false);
    await expect(
      saveContribution("ans1", [{ depenseIndex: 0, amount: 10 }], { id: "", name: "", type: "" }),
    ).resolves.toBe(false);
    expect(espions.addFinancer).not.toHaveBeenCalled();

    mocks.me = { serverData: {} };
    const horsSession = monter();
    await expect(
      horsSession.saveContribution("ans1", [{ depenseIndex: 0, amount: 10 }], FINANCER),
    ).resolves.toBe(false);
    expect(horsSession.espions.addFinancer).not.toHaveBeenCalled();
  });

  it("n'appelle JAMAIS `saveCoformAnswer` — ce fallback écrivait hors format", async () => {
    const { saveContribution, espions } = monter({
      addFinancer: vi.fn(async () => { throw new Error("échec"); }),
    });

    await saveContribution("ans1", [{ depenseIndex: 0, amount: 10, milestoneId: "m1" }], FINANCER);

    expect(espions.saveCoformAnswer).not.toHaveBeenCalled();
  });
});
