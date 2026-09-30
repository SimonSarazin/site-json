// @vitest-environment jsdom
/**
 * Compteur affiché sous le nom : une organisation montre son nombre de PROJETS (elle les porte),
 * un projet montre son nombre de CONTRIBUTEURS (compter ses propres « sous-projets » n'informe de
 * rien — il n'en a pas). Condition générique (`collection === "projects"`, même convention que
 * `CardOverlay.tsx`) — pas un cas spécial « Mes lieux » : ce test verrouille le comportement pour
 * TOUT consommateur de la carte.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

import CardDefault from "./CardDefault";

const item = (collection: string): SearchEntity =>
  ({ id: "1", serverData: { id: "1", name: "Fiche test", collection } }) as unknown as SearchEntity;

describe("CardDefault — compteur sous le nom", () => {
  it("un projet affiche son nombre de CONTRIBUTEURS, pas un nombre de projets", () => {
    render(<CardDefault item={item("projects")} />);
    expect(screen.getByText("CardDefault.contributorCount")).toBeDefined();
    expect(screen.queryByText("CardDefault.projectCount")).toBeNull();
  });

  it("un porteur (organisation) affiche son nombre de PROJETS — comportement inchangé", () => {
    render(<CardDefault item={item("organizations")} />);
    expect(screen.getByText("CardDefault.projectCount")).toBeDefined();
    expect(screen.queryByText("CardDefault.contributorCount")).toBeNull();
  });
});
