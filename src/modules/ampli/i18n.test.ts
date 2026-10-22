// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";

/**
 * Garde-fou sur l'enregistrement du bundle i18n du module ampli.
 *
 * Régression couverte : `import "./i18n"` ne vivait que dans `index.ts`, un barrel que
 * personne n'importe — `discoverModules()` ne globbe que `module.config.ts` et
 * `routes.tsx`, et `SectionRenderer` importe `MeeteemSection` directement. Le namespace
 * n'était donc jamais enregistré et, faute de backend i18next, `useLoadNamespace` ne
 * pouvait pas le rattraper : toutes les clés s'affichaient brutes en production.
 *
 * Les imports sont dynamiques pour observer l'état d'i18next AVANT chaque chargement.
 */
describe("bundle i18n du module ampli", () => {
  it("est enregistré par le simple import de module.config (chemin de découverte du module)", async () => {
    expect(i18n.hasResourceBundle("fr", "modules/ampli")).toBe(false);

    await import("./module.config");

    expect(i18n.hasResourceBundle("fr", "modules/ampli")).toBe(true);
    expect(i18n.hasResourceBundle("en", "modules/ampli")).toBe(true);
    expect(i18n.getResource("fr", "modules/ampli", "MeeteemSection.viewToggle.answers")).toBe("Annuaire");
  });
});

describe("bundle i18n chargé par MeeteemSection seule", () => {
  it("est enregistré par le simple import de la section (chemin SectionRenderer)", async () => {
    // Le test précédent a déjà enregistré le bundle dans ce fichier : on repart d'un
    // i18next vierge et d'un registre de modules vidé pour re-jouer le side-effect.
    i18n.removeResourceBundle("fr", "modules/ampli");
    i18n.removeResourceBundle("en", "modules/ampli");
    vi.resetModules();

    expect(i18n.hasResourceBundle("fr", "modules/ampli")).toBe(false);

    await import("./components/sections/MeeteemSection");

    expect(i18n.hasResourceBundle("fr", "modules/ampli")).toBe(true);
    expect(i18n.getResource("en", "modules/ampli", "AmpliMessage.headline")).toBe("Popular posts");
  });
});
