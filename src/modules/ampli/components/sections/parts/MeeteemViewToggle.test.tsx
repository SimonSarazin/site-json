// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
// Charge le bundle FR/EN sur i18next (side-effect — addResourceBundle).
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import { MeeteemViewToggle } from "./MeeteemViewToggle";

/**
 * Tests du toggle 3 vues MeeteemSection.
 * Composant stateless — value/onChange contrôlés par le parent.
 */
describe("MeeteemViewToggle", () => {
  beforeAll(async () => {
    // Force la langue à FR pour les tests (i18next.fallbackLng = "fr" mais
    // pourrait avoir été mutée par un test précédent en mode globalSetup).
    await i18n.changeLanguage("fr");
  });

  it("rend les 3 boutons avec leurs labels traduits", () => {
    renderWithProviders(<MeeteemViewToggle value="answers" onChange={() => {}} />);
    expect(screen.getByText("Annuaire")).toBeInTheDocument();
    expect(screen.getByText("Carte")).toBeInTheDocument();
    expect(screen.getByText("Split")).toBeInTheDocument();
  });

  it("appelle onChange avec le nouveau mode au clic", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MeeteemViewToggle value="answers" onChange={onChange} />);

    await user.click(screen.getByText("Carte"));
    expect(onChange).toHaveBeenCalledWith("map");

    await user.click(screen.getByText("Split"));
    expect(onChange).toHaveBeenCalledWith("split");
  });

  it("met en évidence le mode actif via la classe 'shadow-sm'", () => {
    const { rerender } = renderWithProviders(<MeeteemViewToggle value="answers" onChange={() => {}} />);
    const answersBtn = screen.getByText("Annuaire").closest("button");
    expect(answersBtn?.className).toContain("shadow-sm");

    rerender(<MeeteemViewToggle value="map" onChange={() => {}} />);
    const mapBtn = screen.getByText("Carte").closest("button");
    expect(mapBtn?.className).toContain("shadow-sm");
  });

  it("propage le clic sur le mode déjà actif (re-clic = no-op côté parent)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MeeteemViewToggle value="answers" onChange={onChange} />);

    await user.click(screen.getByText("Annuaire"));
    expect(onChange).toHaveBeenCalledWith("answers");
  });

  it("supporte la locale EN après changeLanguage", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<MeeteemViewToggle value="answers" onChange={() => {}} />);
    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getByText("Map")).toBeInTheDocument();
    // Restaure FR pour les tests suivants.
    await i18n.changeLanguage("fr");
  });
});
