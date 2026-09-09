// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState, type ReactNode, type MouseEvent } from "react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CoFormAnswer } from "@/modules/coform/types";

/**
 * La carte de financement de la fiche d'un commun (review MR 53, lot 2).
 *
 * Ce qui est sous test, c'est le CÂBLAGE de la carte — l'étape qu'elle lit, ce
 * qu'elle fait d'un visiteur non connecté, ce qu'elle compte — pas les hooks
 * data (cagnotte, React Query), mockés à leur frontière.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), base);
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const CONNECTED = { id: "u1", isConnected: true, serverData: { id: "u1", name: "Alice" } };
const ANONYMOUS = { id: "", isConnected: false, serverData: undefined };
let me: typeof CONNECTED | typeof ANONYMOUS = CONNECTED;
const ENTITY = { id: "host", searchCostum: vi.fn().mockResolvedValue({ results: {} }) };
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me, entity: ENTITY }),
}));

const toggleReaction = vi.fn().mockResolvedValue(true);
vi.mock("@/modules/aac/hooks/useCommunReactions", async (importActual) => {
  const actual = await importActual<typeof import("@/modules/aac/hooks/useCommunReactions")>();
  return { ...actual, useCommunReactions: () => ({ toggleReaction }) };
});

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));
vi.mock("@/modules/aac/hooks/useCommunFundingContext", () => ({
  useCommunFundingContext: () => ({ context: null }),
}));
vi.mock("@/modules/aac/hooks/useCommunFundingHost", () => ({
  useCommunFundingHost: () => ({ hostEntity: null }),
}));
vi.mock("@/modules/aac/hooks/useReactorNames", () => ({
  useReactorNames: () => ({ names: [], isLoading: false }),
}));

const openLogin = vi.fn();
vi.mock("@/modules/auth", () => ({ useAuthModal: () => ({ openLogin }) }));

/**
 * `CagnotteDialog` réel enveloppe son enfant dans un `DialogTrigger asChild`
 * (Radix) : le handler du trigger est composé avec celui de l'enfant et NE JOUE
 * PAS si l'enfant a fait `preventDefault()`. Le stub reproduit exactement cette
 * règle — c'est elle qui rend le test discriminant.
 */
vi.mock("@/modules/cagnotte/components/CagnotteDialog", () => ({
  default: ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
      <div
        data-testid="cagnotte-dialog"
        onClick={(e: MouseEvent) => {
          if (!e.defaultPrevented) setOpen(true);
        }}
      >
        {children}
        {open ? <div data-testid="cagnotte-open" /> : null}
      </div>
    );
  },
}));

const { CommunFinancingCard } = await import("./CommunFinancingCard");

function makeConfig(depenseStepKey: string | null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: true,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}

const ANSWER = {
  _id: { $id: "a1" },
  answers: {},
  links: { contributors: { u9: { type: "citoyens" } } },
  vote: {},
} as unknown as CoFormAnswer;

function renderCard(over: Partial<Parameters<typeof CommunFinancingCard>[0]> = {}) {
  return render(
    <LocalizationProvider>
      <CommunFinancingCard
        formData={{ id: "f1", name: "Appel", inputs: {} } as never}
        answerQuery={ANSWER}
        aacConfig={makeConfig("etapeA")}
        funding={null}
        {...over}
      />
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  me = CONNECTED;
  depenses = [];
  useCommunRawDepenses.mockClear();
  toggleReaction.mockClear();
  openLogin.mockClear();
});

describe("CommunFinancingCard — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderCard({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });

  it("sans étape résolue, laisse le hook à son défaut (argument absent)", () => {
    renderCard({ aacConfig: makeConfig(null) });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", undefined);
  });
});

/**
 * Un élément NEUF à chaque rendu : rerendre le même objet React laisse React
 * court-circuiter tout l'arbre (props identiques), et le nouveau `me` du mock
 * ne serait jamais lu.
 */
const makeUi = () => (
  <LocalizationProvider>
    <CommunFinancingCard
      formData={{ id: "f1", name: "Appel", inputs: {} } as never}
      answerQuery={ANSWER}
      aacConfig={makeConfig("etapeA")}
      funding={null}
    />
  </LocalizationProvider>
);

/** Simule une connexion réussie : le callback `onSuccess` du modal, puis l'arrivée de `me`. */
async function connecter(rerender: (ui: React.ReactElement) => void) {
  const opts = openLogin.mock.calls[0]?.[0] as { onSuccess?: () => void } | undefined;
  await act(async () => {
    opts?.onSuccess?.();
  });
  me = CONNECTED;
  await act(async () => {
    rerender(makeUi());
  });
}

describe("CommunFinancingCard — « Financer ce commun » hors connexion ouvre la connexion (M14)", () => {
  /**
   * Avant : `disabled={… || !me?.isConnected}` — un bouton grisé, sans message
   * ni chemin vers la connexion (CLAUDE.md, gotcha n° 11).
   */
  it("le bouton reste actif ; le clic ouvre le modal de connexion, PAS la cagnotte", () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard();

    const bouton = screen.getByRole("button", { name: /detail\.financing\.cta/ });
    expect(bouton).not.toBeDisabled();

    fireEvent.click(bouton);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();
  });

  it("une fois connecté, la cagnotte s'ouvre d'elle-même", async () => {
    me = ANONYMOUS;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    const { rerender } = render(makeUi());
    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.cta/ }));
    expect(screen.queryByTestId("cagnotte-open")).toBeNull();

    await connecter(rerender);
    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
  });

  it("connecté, le clic ouvre directement la cagnotte", () => {
    me = CONNECTED;
    depenses = [{ poste: "Serveur", priceInt: 1000 }];
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /detail\.financing\.cta/ }));
    expect(openLogin).not.toHaveBeenCalled();
    expect(screen.getByTestId("cagnotte-open")).toBeTruthy();
  });
});

describe("CommunFinancingCard — les CTA de réaction hors connexion ouvrent la connexion (M15)", () => {
  /**
   * Avant : le clic appliquait l'optimisme (+1), appelait `toggleReaction` sans
   * réacteur → toast d'erreur, puis −1. L'action ne pouvait jamais aboutir.
   */
  it("« Je contribue » n'appelle pas `toggleReaction`, ne touche pas au compteur, ouvre la connexion", () => {
    me = ANONYMOUS;
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /detail\.contribute/ }));

    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(toggleReaction).not.toHaveBeenCalled();
    // Un contributeur dans `links.contributors` : le compteur reste à 1.
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("une fois connecté, la réaction demandée est rejouée avec le réacteur de la session", async () => {
    me = ANONYMOUS;
    const { rerender } = render(makeUi());
    fireEvent.click(screen.getByRole("button", { name: /detail\.vote/ }));
    expect(toggleReaction).not.toHaveBeenCalled();

    await connecter(rerender);
    expect(toggleReaction).toHaveBeenCalledWith("a1", "love", "u1", "Alice");
  });
});
