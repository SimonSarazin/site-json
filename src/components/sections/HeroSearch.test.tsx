// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";

/**
 * Lancement de la recherche du héros `hero-search`. Avec `searchHref`, « Rechercher » mène à la page de
 * recherche complète (texte + filtres actifs) au lieu de filtrer l'aperçu de la page — l'accueil de
 * tiers-lieux n'en montre que 5. Sans `searchHref`, la liste de la page est filtrée sur place.
 */
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : (v as { fr?: string })?.fr ?? "") }),
}));
vi.mock("@/modules/search/hooks/useAutocomplete", () => ({
  useAutocomplete: () => ({ suggestions: [], isLoading: false }),
}));
vi.mock("@/modules/search/hooks/usePageFiltersUrlSync", () => ({ usePageFiltersUrlSync: () => undefined }));
const services = { enabled: false, isLoading: false, suggestions: [] as Array<{ id: string; title: string; subtitle: string; href: string }> };
vi.mock("@/modules/search/hooks/useServiceSuggestions", () => ({ useServiceSuggestions: () => services }));
const setSearchQuery = vi.fn();
vi.mock("@/modules/search/contexts/pageFilters", () => ({
  usePageFiltersOptional: () => ({ setSearchQuery, selectedFilters: {}, searchByFields: {} }),
}));

import { HeroSearch } from "./HeroSearch";

function Lieu() {
  const l = useLocation();
  return <output data-testid="lieu">{l.pathname + l.search}</output>;
}

const hero = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter initialEntries={["/?typologies=Coworking"]}>
      <HeroSearch props={{ headline: { fr: "Titre" }, placeholder: { fr: "Ville" }, ...props } as never} />
      <Lieu />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  setSearchQuery.mockClear();
  services.enabled = false;
  services.suggestions = [];
});

describe("HeroSearch — lancement de la recherche", () => {
  it("avec `searchHref` : ouvre la page de recherche avec le texte et les filtres actifs", () => {
    hero({ searchHref: "/lieux" });
    fireEvent.change(screen.getByPlaceholderText("Ville"), { target: { value: " Lille " } });
    fireEvent.click(screen.getAllByText("Rechercher")[0]);
    expect(screen.getByTestId("lieu").textContent).toBe("/lieux?typologies=Coworking&search=Lille");
    expect(setSearchQuery).not.toHaveBeenCalled();
  });

  it("avec `searchHref`, champ vide : y va quand même, avec les seuls filtres", () => {
    hero({ searchHref: "/lieux" });
    fireEvent.keyDown(screen.getByPlaceholderText("Ville"), { key: "Enter" });
    expect(screen.getByTestId("lieu").textContent).toBe("/lieux?typologies=Coworking");
  });

  it("sans `searchHref` : filtre la liste de la page, sans changer de page", () => {
    hero({});
    fireEvent.change(screen.getByPlaceholderText("Ville"), { target: { value: "Lille" } });
    fireEvent.click(screen.getAllByText("Rechercher")[0]);
    expect(setSearchQuery).toHaveBeenCalledWith("Lille");
    expect(screen.getByTestId("lieu").textContent).toBe("/?typologies=Coworking");
  });

  it("suggestions de services : nom + lieu, le choix ouvre le détail du service dans l'annuaire", () => {
    services.enabled = true;
    services.suggestions = [
      { id: "r1", title: "Salle Majorelle", subtitle: "La Coroutine · Lille", href: "/annuaire-ressources?resource=r1" },
    ];
    hero({ searchHref: "/annuaire-ressources", serviceSuggestions: { page: "/annuaire-ressources", sectionId: "x" } });
    fireEvent.change(screen.getByPlaceholderText("Ville"), { target: { value: "major" } });
    expect(screen.getByText("La Coroutine · Lille")).toBeTruthy();
    fireEvent.click(screen.getByText("Salle Majorelle"));
    expect(screen.getByTestId("lieu").textContent).toBe("/annuaire-ressources?resource=r1");
  });
});
