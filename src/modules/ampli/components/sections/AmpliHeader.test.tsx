// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../tests/test-utils-ui";
import { AMPLI_SECTION_IDS } from "../../constants/sectionIds";

/**
 * Tests des appels à l'action du hero. Le bouton « Rejoindre » a ses propres
 * tests (`parts/AmpliJoinButton.test.tsx`) et dépend du provider Cocolight :
 * il est mocké ici, on vérifie seulement qu'il est bien à sa place.
 */

const scrollToSection = vi.fn();
vi.mock("../../utils/scrollToSection", () => ({
  scrollToSection: (...args: unknown[]) => scrollToSection(...args),
}));
vi.mock("./parts/AmpliJoinButton", () => ({
  AmpliJoinButton: () => <button type="button">Rejoindre la communauté</button>,
}));

const AmpliHeader = (await import("./AmpliHeader")).default;

describe("AmpliHeader", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    scrollToSection.mockClear();
  });

  it("propose les trois actions du hero", () => {
    renderWithProviders(<AmpliHeader props={undefined} />);

    expect(screen.getByRole("button", { name: /Proposer une idée/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voir les propositions/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rejoindre la communauté/ })).toBeInTheDocument();
  });

  // « Proposer une idée » mène AU formulaire de la page (section « Proposez
  // votre idée »), pas à une seconde copie du même formulaire en modale.
  it("mène au formulaire de proposition, curseur dans le premier champ", async () => {
    renderWithProviders(<AmpliHeader props={undefined} />);

    await userEvent.click(screen.getByRole("button", { name: /Proposer une idée/ }));

    expect(scrollToSection).toHaveBeenCalledWith(AMPLI_SECTION_IDS.FEATURES, { focus: true });
  });

  it("mène à l'annuaire des propositions", async () => {
    renderWithProviders(<AmpliHeader props={undefined} />);

    await userEvent.click(screen.getByRole("button", { name: /Voir les propositions/ }));

    expect(scrollToSection).toHaveBeenCalledWith(AMPLI_SECTION_IDS.MESSAGES);
  });
});
