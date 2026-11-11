// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  enabled: true,
  adminOrgs: [{ id: "org1" }] as Array<{ id: string }>,
  live: undefined as unknown,
  liveArgs: null as null | { ids: string[]; enabled?: boolean },
}));

vi.mock("@/modules/cagnotte/hooks/usePledgeRetractionEnabled", () => ({ usePledgeRetractionEnabled: () => mocks.enabled }));
vi.mock("@/modules/cagnotte/hooks/useUserAdminOrganizations", () => ({ useUserAdminOrganizations: () => mocks.adminOrgs }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: { id: "u1" } }) }));
vi.mock("@/lib/getTypedEntity", () => ({ isUser: () => true }));
vi.mock("@/modules/cagnotte/hooks/usePledgesInProgress", () => ({
  usePledgesInProgress: (ids: string[], opts?: { enabled?: boolean }) => {
    mocks.liveArgs = { ids: [...ids], enabled: opts?.enabled };
    return mocks.live;
  },
}));

const { useCommunPledgeRetraction } = await import("./useCommunPledgeRetraction");

const ligne = (id: string, finkey: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Nom ${id}`,
  amount: 250,
  status: "pending",
  finkey,
  payment: { logs: [] },
  ...extra,
});

/** Dépenses en objet à clés creuses : la clé « 4 » est en position 1. */
const DOCUMENT = {
  0: { poste: "Local", financer: [ligne("u1", "a-own")] },
  4: {
    poste: "Site",
    financer: [
      ligne("org1", "a-org"),
      ligne("u2", "a-tiers"),
      ligne("u2", "a-paye", { payment: { logs: [{ amount: 250, confirmation: "validated" }] } }),
      ligne("u1", "a-encours"),
    ],
  },
};

/** Enveloppe du commun : une promesse réservée, et une contribution en cours sur le palier m1 et la dépense « 4 ». */
const ENVELOPPE = {
  paymentsInProgress: {
    ans1: {
      pledges: [{ finkey: "a-encours", kind: "hold", mine: false, until: 1 }],
      depenses: [{ milestoneId: "m1", depenseKey: "" }, { milestoneId: "", depenseKey: "4" }],
    },
  },
};

const affichee = (financerId: string, finkey: string) =>
  ({ id: `x-${finkey}`, financerId, financerName: `Affiché ${financerId}`, finkey, amount: 1 }) as never;

function hook(over: Partial<Parameters<typeof useCommunPledgeRetraction>[0]> = {}) {
  return renderHook(() =>
    useCommunPledgeRetraction({
      answerId: "ans1",
      depensesDocument: DOCUMENT,
      depenseStepKey: "aapStep1",
      isCommunAdmin: false,
      isConnected: true,
      currentUserId: "u1",
      inProgressFallback: ENVELOPPE,
      ...over,
    }),
  ).result.current;
}

beforeEach(() => {
  mocks.enabled = true;
  mocks.adminOrgs = [{ id: "org1" }];
  mocks.live = undefined;
  mocks.liveArgs = null;
});

describe("useCommunPledgeRetraction — qui voit « Retirer », sur quelle ligne", () => {
  it("sa propre promesse : la demande porte la CLÉ de la dépense et le montant du document", () => {
    expect(hook().stateFor(affichee("u1", "a-own"), "Local")).toEqual({
      request: {
        answerId: "ans1",
        depenseKey: "0",
        financerId: "u1",
        finkey: "a-own",
        financerName: "Affiché u1",
        amount: 250,
        depenseName: "Local",
      },
      paymentInProgress: false,
    });
  });

  it("promesse d'une organisation administrée : oui ; d'un tiers : non", () => {
    const ctrl = hook();
    expect(ctrl.stateFor(affichee("org1", "a-org"), "Site")?.request.depenseKey).toBe("4");
    expect(ctrl.stateFor(affichee("u2", "a-tiers"), "Site")).toBeNull();
  });

  it("admin du commun (porteur, admin du projet) : la promesse d'un tiers aussi", () => {
    expect(hook({ isCommunAdmin: true }).stateFor(affichee("u2", "a-tiers"), "Site")?.request.finkey).toBe("a-tiers");
  });

  it("une promesse qui porte un versement ne se retire jamais, même pour un admin", () => {
    expect(hook({ isCommunAdmin: true }).stateFor(affichee("u2", "a-paye"), "Site")).toBeNull();
  });

  it("ligne absente du document (enveloppe seule) : pas de bouton", () => {
    expect(hook({ isCommunAdmin: true }).stateFor(affichee("u1", "a-inconnue"), "Local")).toBeNull();
  });

  it("paiement en cours : la ligne le signale au lieu de proposer le retrait", () => {
    expect(hook().stateFor(affichee("u1", "a-encours"), "Site")?.paymentInProgress).toBe(true);
    expect(hook().stateFor(affichee("u1", "a-own"), "Local")?.paymentInProgress).toBe(false);
  });

  it.each([
    ["clé du site désactivée", () => { mocks.enabled = false; }, {}],
    ["visiteur non connecté", () => {}, { isConnected: false }],
    ["dépenses lues à une autre étape (le serveur ne lit que aapStep1)", () => {}, { depenseStepKey: "aapStep2" }],
    ["réponse non résolue", () => {}, { answerId: "" }],
  ])("%s : aucun bouton", (_label, arrange, over) => {
    arrange();
    expect(hook({ isCommunAdmin: true, ...over }).stateFor(affichee("u1", "a-own"), "Local")).toBeNull();
  });

  it("sans étape résolue, c'est aapStep1", () => {
    expect(hook({ depenseStepKey: null }).stateFor(affichee("u1", "a-own"), "Local")).not.toBeNull();
  });
});

describe("useCommunPledgeRetraction — contribution en cours sur un palier", () => {
  const palier = (milestoneId: string, depenseIndex: number, depenseKey?: string) =>
    ({ milestoneId, depenseIndex, depenseKey }) as never;

  it("par le jalon, ou par la CLÉ de la dépense lue dans le document (position 1 → clé « 4 »)", () => {
    expect(hook().depenseInProgress(palier("m1", 0))).toBe(true);
    expect(hook().depenseInProgress(palier("", 1))).toBe(true);
    expect(hook().depenseInProgress(palier("", 0))).toBe(false);
    expect(hook().depenseInProgress(palier("", 0, "4"))).toBe(true);
  });

  it("indépendant de la clé du site : la suppression d'un palier attend l'issue du paiement", () => {
    mocks.enabled = false;
    const retrait = hook();
    expect(retrait.depenseInProgress(palier("m1", 0))).toBe(true);
    expect(retrait.showDepenseProgress).toBe(false);
  });

  it("réponse non résolue : rien en cours", () => {
    expect(hook({ answerId: "" }).depenseInProgress(palier("m1", 0))).toBe(false);
  });
});

describe("useCommunPledgeRetraction — relecture des paiements en cours", () => {
  it("financeur d'une promesse retirable : relecture de ce commun", () => {
    hook();
    expect(mocks.liveArgs).toEqual({ ids: ["ans1"], enabled: true });
  });

  it("admin du commun : relecture, même sans promesse à lui", () => {
    hook({ isCommunAdmin: true, currentUserId: "u-aucun" });
    expect(mocks.liveArgs?.enabled).toBe(true);
  });

  it("visiteur sans promesse retirable ni droit d'admin : pas de relecture, l'enveloppe fait foi", () => {
    mocks.adminOrgs = [];
    const retrait = hook({ currentUserId: "u-aucun" });

    expect(mocks.liveArgs?.enabled).toBe(false);
    expect(retrait.depenseInProgress({ milestoneId: "m1", depenseIndex: 0 } as never)).toBe(true);
  });

  it.each([
    ["clé du site désactivée", () => { mocks.enabled = false; }, {}],
    ["visiteur non connecté", () => {}, { isConnected: false }],
  ])("%s : pas de relecture", (_label, arrange, over) => {
    arrange();
    hook({ isCommunAdmin: true, ...over });
    expect(mocks.liveArgs?.enabled).toBe(false);
  });

  it("la relecture, quand elle a répondu, remplace l'enveloppe", () => {
    mocks.live = { paymentsInProgress: { ans1: { pledges: [{ finkey: "a-own", kind: "hold", mine: false }], depenses: [] } } };
    const retrait = hook();

    expect(retrait.stateFor(affichee("u1", "a-own"), "Local")?.paymentInProgress).toBe(true);
    expect(retrait.stateFor(affichee("u1", "a-encours"), "Site")?.paymentInProgress).toBe(false);
  });
});
