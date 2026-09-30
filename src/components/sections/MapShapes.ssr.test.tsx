// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { LocalizationContext } from "@/contexts/LocalizationContext";
import type { LocalizedString } from "@/types/locale-schema";
import type { MapShapesProps } from "@/types/site-schema";

/**
 * Parité SSR de la section `map-shapes`, épinglée avec le VRAI `useGeoShapes` et le VRAI
 * `useHydrated` (`MapShapes.test.tsx` stube le premier : il vérifie le rendu, pas l'invariant).
 *
 * Le serveur ne fetch jamais les contours : son HTML doit être le SQUELETTE, que l'API du site ait
 * répondu ou non. Le client résout sa propre entité et peut réussir là où le serveur a échoué ; un
 * HTML serveur « Aucun contour » ne correspond alors plus à son premier rendu (le squelette) —
 * erreur d'hydratation reproduite avec un backend en 500 sur la résolution du slug du site.
 */

const contexte: { entity: unknown } = { entity: null };
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => contexte }));

import MapShapes from "./MapShapes";

const PROPS: MapShapesProps = {
  shapes: [{ id: "bassins", source: "zoniris", filters: { spec: "bassins_vie_saintpaul" } }],
  target: { path: "/equipements-sportifs", filterId: "bassin", valueFrom: "_id" },
};

const localisation = {
  currentLocale: "fr" as const,
  setLocale: () => {},
  availableLocales: ["fr", "en"] as const,
  t: (text: LocalizedString) => (typeof text === "string" ? text : (text.fr ?? "")),
};

function htmlServeur(entity: unknown): string {
  contexte.entity = entity;
  return renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <LocalizationContext.Provider value={localisation}>
        <MemoryRouter>
          <MapShapes props={PROPS} />
        </MemoryRouter>
      </LocalizationContext.Provider>
    </QueryClientProvider>,
  );
}

describe("MapShapes — HTML serveur", () => {
  it("API du site non résolue : le squelette, jamais « Aucun contour »", () => {
    const html = htmlServeur(null);

    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain("Aucun contour");
  });

  it("le HTML est le même, que l'API du site ait répondu ou non", () => {
    const entite = { getZoneShape: vi.fn(), getZoniris: vi.fn() };

    expect(htmlServeur(entite)).toBe(htmlServeur(null));
    // Rien ne part pendant le rendu serveur : c'est ce qui rend les deux HTML comparables.
    expect(entite.getZoniris).not.toHaveBeenCalled();
  });
});
