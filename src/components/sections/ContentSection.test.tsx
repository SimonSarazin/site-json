// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

/**
 * Un lien markdown EXTERNE dans `description` (ex. un PDF communecter cité dans une charte) doit
 * s'ouvrir en nouvel onglet — sinon le clic fait quitter le site en pleine page. Un lien RELATIF
 * (interne au site) reste inchangé.
 */
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : (v as { fr?: string })?.fr ?? "") }),
}));

import { ContentSection } from "./ContentSection";

afterEach(cleanup);

const renderSection = (description: string) =>
  render(
    <MemoryRouter>
      <ContentSection props={{ title: { fr: "Titre" }, description: { fr: description } } as never} />
    </MemoryRouter>,
  );

describe("ContentSection — liens markdown de la description", () => {
  it("ouvre un lien externe (http/https) en nouvel onglet", () => {
    const { container } = renderSection("[doc](https://www.communecter.org/upload/x.pdf)");
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("laisse un lien relatif (interne) sans target", () => {
    const { container } = renderSection("[page](/annuaire)");
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a).not.toHaveAttribute("target");
  });

  // `classifyHref` classe aussi `//hôte/chemin` en externe (cf. `linkKind.ts`) — une regex locale
  // `^https?://` manquait ce cas (revue du 09/11).
  it("ouvre un lien protocole-relatif (//hôte) en nouvel onglet", () => {
    const { container } = renderSection("[doc](//cdn.exemple.org/x.pdf)");
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });
});
