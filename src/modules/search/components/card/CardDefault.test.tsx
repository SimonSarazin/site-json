// @vitest-environment jsdom
/**
 * Badge « N projets » : a du sens pour un PORTEUR (organisation, citoyen…) mais pas pour un item
 * qui EST déjà lui-même un projet (« 0 projet » sur sa propre carte, cf. la demande utilisateur).
 * Condition générique (`collection !== "projects"`, même convention que `CardOverlay.tsx`) — pas un
 * cas spécial « Mes lieux » : ce test verrouille le comportement pour TOUT consommateur de la carte.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

import CardDefault from "./CardDefault";

const item = (collection: string): SearchEntity =>
  ({ id: "1", serverData: { id: "1", name: "Fiche test", collection } }) as unknown as SearchEntity;

describe("CardDefault — badge « N projets »", () => {
  it("masqué quand l'item EST un projet (pas de « 0 projet » sur sa propre carte)", () => {
    render(<CardDefault item={item("projects")} />);
    expect(screen.queryByText(/projets/i)).toBeNull();
  });

  it("affiché pour un porteur (organisation) — comportement inchangé", () => {
    render(<CardDefault item={item("organizations")} />);
    expect(screen.getByText(/projets/i)).toBeDefined();
  });
});
