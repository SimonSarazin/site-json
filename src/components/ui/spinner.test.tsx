// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  it("par défaut, le label est réservé aux lecteurs d'écran", () => {
    render(<Spinner label="Envoi…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Envoi…");
    expect(screen.getByText("Envoi…")).toHaveClass("sr-only");
  });

  it("un label AFFICHÉ se fournit : le défaut, écrit en français, n'est pas fait pour l'écran", () => {
    // @ts-expect-error — `showLabel` sans `label` ne compile pas.
    const sansLabel = <Spinner showLabel />;
    expect(sansLabel).toBeTruthy();
  });

  it("`showLabel` l'affiche — un seul texte, dans le seul `role=\"status\"`", () => {
    render(<Spinner showLabel label="Recherche en cours…" />);
    expect(screen.getAllByText("Recherche en cours…")).toHaveLength(1);
    expect(screen.getByText("Recherche en cours…")).not.toHaveClass("sr-only");
    expect(screen.getByRole("status")).toHaveTextContent("Recherche en cours…");
  });
});
