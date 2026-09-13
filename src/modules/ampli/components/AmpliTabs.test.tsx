// @vitest-environment jsdom
import { describe, expect, it, beforeAll } from "vitest";
import { MemoryRouter } from "react-router";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen } from "../../../../tests/test-utils-ui";
import { AmpliTabs } from "./AmpliTabs";

describe("AmpliTabs", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  const renderTabs = (activeTab: string) =>
    renderWithProviders(
      <MemoryRouter>
        <AmpliTabs slug="sinistre" activeTab={activeTab} />
      </MemoryRouter>,
    );

  it("affiche les quatre onglets, sans « Messages » (section de la page d'accueil)", () => {
    renderTabs("home");

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/ampli/sinistre");
    expect(screen.getByRole("link", { name: "Réseau" })).toHaveAttribute("href", "/ampli/sinistre/community");
    expect(screen.getByRole("link", { name: "Statistiques" })).toHaveAttribute("href", "/ampli/sinistre/stats");
    expect(screen.getByRole("link", { name: "Actualités" })).toHaveAttribute("href", "/ampli/sinistre/news");
    expect(screen.queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
  });

  it("marque l'onglet courant pour les lecteurs d'écran", () => {
    renderTabs("stats");

    expect(screen.getByRole("link", { name: "Statistiques" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });
});
