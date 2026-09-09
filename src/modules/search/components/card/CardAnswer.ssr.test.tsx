// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Parité SSR du gate « Fiche structure », épinglée avec le VRAI `useHydrated`.
 *
 * `CardAnswer.test.tsx` mocke `useHydrated` : il vérifie le câblage, pas l'invariant.
 * Ici on rend côté SERVEUR, avec un `me` d'ayant droit — le pire cas, celui qui
 * produirait un mismatch d'hydratation si la garde disparaissait ou était remplacée
 * par une source qui vaut `true` au serveur. Le bouton doit être ABSENT.
 */

const ORG_ID = "69281757564b0621d52ebb67";
const FICHE = "coformAnswer.structureSheet";

// Seule l'identité est simulée : `useHydrated` reste le vrai hook (false au serveur,
// son setState vivant dans un useEffect qui ne s'exécute pas au SSR).
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({
    me: { ...{ isSuperAdmin: () => false, isAdminPlatform: () => false },
      serverData: { links: { memberOf: { [ORG_ID]: { isAdmin: true } } } } },
    entity: { isAdmin: () => true },
  }),
}));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/useEntityBySlugQuery", () => ({
  useEntityBySlugQuery: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("../SwitchDetailsMode", () => ({ SwitchDetailsMode: () => null }));

import CardAnswer from "./CardAnswer";

const item = {
  serverData: {
    name: "Gym douce",
    structure: { name: "ADAPTETONSPORT", slug: "adaptetonsport", _id: { _str: ORG_ID } },
  },
} as unknown as SearchEntity;

describe("CardAnswer — parité SSR du gate « Fiche structure »", () => {
  it("audience managers : absent du HTML serveur même pour un ayant droit", () => {
    const html = renderToString(
      <CardAnswer item={item} card={{ type: "card-answer", structureAction: { audience: "managers" } } as never} />,
    );
    expect(html).not.toContain(FICHE);
    // La carte est bien rendue par ailleurs : c'est le bouton qui manque, pas le SSR.
    expect(html).toContain("Gym douce");
  });

  it("sans opt-in : présent dans le HTML serveur (parc inchangé)", () => {
    const html = renderToString(<CardAnswer item={item} card={{ type: "card-answer" } as never} />);
    expect(html).toContain(FICHE);
  });
});
