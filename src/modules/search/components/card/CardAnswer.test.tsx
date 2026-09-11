// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Visibilité du bouton « Fiche structure » : opt-in `card.structureAction.audience`
 * × règle de gestion × hydratation. La RÈGLE de droits elle-même est déjà couverte par
 * `coformAnswer.test.ts` (`isCoformAnswerManager`) — on ne la re-teste pas, on teste le
 * CÂBLAGE, seule logique neuve, et la non-régression des sites qui n'ont pas opté.
 */

// Les deux seules entrées du gate — mutables pour rejouer le rendu sous plusieurs identités.
const ctx = vi.hoisted(() => ({
  hydrated: true,
  me: null as unknown,
  entity: { isAdmin: () => false } as unknown,
}));
vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => ctx.hydrated }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ctx.me, entity: ctx.entity }) }));

// `useT` renvoie la clé brute : les assertions portent dessus.
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));

// Hors périmètre du gate.
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/useEntityBySlugQuery", () => ({
  useEntityBySlugQuery: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../SwitchDetailsMode", () => ({ SwitchDetailsMode: () => null }));

import CardAnswer from "./CardAnswer";

const ORG_ID = "69281757564b0621d52ebb67";
const AUTRE_ORG = "111111111111111111111111";
const FICHE = "coformAnswer.structureSheet";
const lambda = { isSuperAdmin: () => false, isAdminPlatform: () => false };
const adminDe = (orgId: string) => ({
  ...lambda,
  serverData: { links: { memberOf: { [orgId]: { isAdmin: true } } } },
});

// Encodage `_str` : celui observé sur le payload SSR réel de /creneaux.
const item = {
  serverData: {
    name: "Gym douce",
    structure: { name: "ADAPTETONSPORT", slug: "adaptetonsport", _id: { _str: ORG_ID } },
  },
} as unknown as SearchEntity;

const MANAGERS = { type: "card-answer", structureAction: { audience: "managers" } } as never;

beforeEach(() => {
  ctx.hydrated = true;
  ctx.me = null;
  ctx.entity = { isAdmin: () => false };
});

describe("CardAnswer — audience du bouton « Fiche structure »", () => {
  it("sans opt-in : bouton visible pour un visiteur anonyme (parc inchangé)", () => {
    const { queryByText } = render(<CardAnswer item={item} card={{ type: "card-answer" } as never} />);
    expect(queryByText(FICHE)).not.toBeNull();
  });

  it("sans opt-in : ne dépend NI de l'hydratation NI de me (court-circuit)", () => {
    ctx.hydrated = false;
    const { queryByText } = render(<CardAnswer item={item} card={{ type: "card-answer" } as never} />);
    expect(queryByText(FICHE)).not.toBeNull();
  });

  it("audience managers : masqué pour un visiteur anonyme", () => {
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).toBeNull();
  });

  it("audience managers : masqué pour un simple connecté sans droit", () => {
    ctx.me = lambda;
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).toBeNull();
  });

  it("audience managers : visible pour le super-admin plateforme", () => {
    ctx.me = { isSuperAdmin: () => true, isAdminPlatform: () => false };
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).not.toBeNull();
  });

  it("audience managers : visible pour l'admin du costum porteur", () => {
    ctx.me = lambda;
    ctx.entity = { isAdmin: () => true };
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).not.toBeNull();
  });

  it("audience managers : visible pour l'admin de LA structure de cette carte", () => {
    ctx.me = adminDe(ORG_ID);
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).not.toBeNull();
  });

  it("audience managers : masqué pour l'admin d'une AUTRE structure", () => {
    ctx.me = adminDe(AUTRE_ORG);
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).toBeNull();
  });

  // Parité SSR : au serveur `me` vaut toujours null et `hydrated` false ; un gestionnaire
  // doit donc voir le MÊME rendu (pas de bouton) au 1er passage — sinon mismatch.
  it("audience managers : masqué avant hydratation MÊME pour un ayant droit", () => {
    ctx.hydrated = false;
    ctx.me = adminDe(ORG_ID);
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText(FICHE)).toBeNull();
  });

  it("le bouton « Fiche activité » n'est jamais gaté par l'audience", () => {
    const { queryByText } = render(<CardAnswer item={item} card={MANAGERS} />);
    expect(queryByText("coformAnswer.activitySheet")).not.toBeNull();
  });
});
