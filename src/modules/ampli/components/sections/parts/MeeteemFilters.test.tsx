// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import { MeeteemFilters } from "./MeeteemFilters";

/**
 * Tests de l'accordéon de filtres MeeteemSection.
 * Gère son propre state `collapsed` localement, le reste est contrôlé par le parent.
 */
describe("MeeteemFilters", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("ne rend rien si aucun tag disponible", () => {
    const { container } = renderWithProviders(
      <MeeteemFilters availableTags={[]} activeFilters={[]} onToggleFilter={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("rend le titre 'Filtres' et la liste des tags ouverte par défaut", () => {
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food", "music", "art"]}
        activeFilters={[]}
        onToggleFilter={() => {}}
      />,
    );
    expect(screen.getByText("Filtres")).toBeInTheDocument();
    expect(screen.getByText("food")).toBeInTheDocument();
    expect(screen.getByText("music")).toBeInTheDocument();
    expect(screen.getByText("art")).toBeInTheDocument();
  });

  it("affiche le compteur de filtres actifs", () => {
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food", "music"]}
        activeFilters={["food", "music"]}
        onToggleFilter={() => {}}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("appelle onToggleFilter au clic sur un tag", async () => {
    const onToggleFilter = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food", "music"]}
        activeFilters={[]}
        onToggleFilter={onToggleFilter}
      />,
    );

    await user.click(screen.getByText("food"));
    expect(onToggleFilter).toHaveBeenCalledWith("food");

    await user.click(screen.getByText("music"));
    expect(onToggleFilter).toHaveBeenCalledWith("music");
  });

  it("collapse/expand au clic sur le header", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food"]}
        activeFilters={[]}
        onToggleFilter={() => {}}
      />,
    );

    // Ouvert par défaut
    expect(screen.getByText("food")).toBeInTheDocument();

    // Click sur le header (le bouton qui contient "Filtres")
    const header = screen.getByText("Filtres").closest("button");
    expect(header).toBeInTheDocument();
    await user.click(header!);

    // Tag masqué après collapse
    expect(screen.queryByText("food")).not.toBeInTheDocument();

    // Re-click pour ré-ouvrir
    await user.click(header!);
    expect(screen.getByText("food")).toBeInTheDocument();
  });

  it("style différent pour les tags actifs vs inactifs", () => {
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food", "music"]}
        activeFilters={["food"]}
        onToggleFilter={() => {}}
      />,
    );

    const foodBtn = screen.getByText("food");
    const musicBtn = screen.getByText("music");

    // Tag actif a bg-primary, inactif a border-border
    expect(foodBtn.className).toContain("bg-primary");
    expect(musicBtn.className).toContain("border-border");
  });

  it("ne pas afficher de compteur si activeFilters vide", () => {
    renderWithProviders(
      <MeeteemFilters
        availableTags={["food", "music"]}
        activeFilters={[]}
        onToggleFilter={() => {}}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
