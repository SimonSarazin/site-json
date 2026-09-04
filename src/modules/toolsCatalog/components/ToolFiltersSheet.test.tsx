// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ToolsCatalogFacets } from "@communecter/cocolight-api-client";

/**
 * Accès mobile aux filtres du catalogue.
 *
 * Ce qui est verrouillé ici, c'est ce que le passage « barre latérale visible »
 * → « panneau replié » fait perdre : une fois le panneau refermé, l'utilisateur
 * n'a plus aucune pastille sous les yeux. Le compteur devient le seul indice
 * qu'un filtre est encore appliqué, et la remise à zéro le seul moyen simple
 * d'en sortir.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

const { ToolFiltersSheet } = await import("./ToolFiltersSheet");

const FACETS: ToolsCatalogFacets = {
  categories: ["Communication", "Gestion"],
  usages: ["Visio", "Compta"],
  usagesByCategory: { Communication: ["Visio"], Gestion: ["Compta"] },
} as unknown as ToolsCatalogFacets;

const onCategoryChange = vi.fn();
const onUsageChange = vi.fn();

function poser(over: Partial<Parameters<typeof ToolFiltersSheet>[0]> = {}) {
  return render(
    <ToolFiltersSheet
      facets={FACETS}
      category=""
      usage=""
      showCategory
      showUsage
      hasFacets
      onCategoryChange={onCategoryChange}
      onUsageChange={onUsageChange}
      {...over}
    />
  );
}

const ouvrir = () => fireEvent.click(screen.getByRole("button", { name: /filter.title/ }));

describe("ToolFiltersSheet", () => {
  beforeEach(() => {
    onCategoryChange.mockClear();
    onUsageChange.mockClear();
  });

  it("ne montre qu'un bouton tant qu'on ne l'ouvre pas", () => {
    poser();
    expect(screen.getByRole("button", { name: /filter.title/ })).toBeTruthy();
    // Les pastilles ne sont pas dans le DOM : c'est tout l'intérêt du repli.
    expect(screen.queryByRole("button", { name: "Communication" })).toBeNull();
  });

  it("ouvre les filtres — les MÊMES que le desktop", () => {
    poser();
    ouvrir();
    expect(screen.getByRole("button", { name: "Communication" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compta" })).toBeTruthy();
  });

  it("aucun compteur quand rien n'est filtré", () => {
    // Assertion sur l'ABSENCE de tout chiffre, pas sur l'absence de « 1 » :
    // un badge rendu inconditionnellement afficherait « 0 » et passerait au
    // travers d'une assertion ciblée sur une valeur précise.
    poser();
    expect(screen.getByRole("button", { name: /filter.title/ }).textContent).not.toMatch(/\d/);
  });

  it("compte les filtres actifs — seul indice visible panneau fermé", () => {
    poser({ category: "Communication" });
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("compte la catégorie ET la sous-catégorie", () => {
    poser({ category: "Communication", usage: "Visio" });
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("la remise à zéro efface les DEUX niveaux", () => {
    // Changer la catégorie remet déjà la sous-catégorie à zéro côté parent,
    // mais la remise à zéro doit valoir aussi quand seule la sous-catégorie
    // est posée.
    poser({ category: "Communication", usage: "Visio" });
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: /filter.reset/ }));
    expect(onCategoryChange).toHaveBeenCalledWith("");
    expect(onUsageChange).toHaveBeenCalledWith("");
  });

  it("pas de remise à zéro proposée quand il n'y a rien à effacer", () => {
    poser();
    ouvrir();
    expect(screen.queryByRole("button", { name: /filter.reset/ })).toBeNull();
  });

  it("montre le squelette tant que les facettes ne sont pas chargées", () => {
    // Même choix que la barre latérale : on réserve la place au lieu d'ouvrir
    // un panneau vide.
    poser({ hasFacets: false });
    ouvrir();
    expect(screen.queryByRole("button", { name: "Communication" })).toBeNull();
  });
});
