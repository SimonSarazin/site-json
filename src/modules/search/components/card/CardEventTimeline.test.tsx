// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import CardEventTimeline from "./CardEventTimeline";

// `useT` (bouton « En savoir plus ») passe par useLocalization → provider requis ;
// mock minimal, même convention que ExpandableActions.test.tsx.
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (v: unknown) => (typeof v === "string" ? v : ((v as { fr?: string })?.fr ?? "")) }),
}));

/**
 * Carte compacte de la vue timeline : heure de début, chip catégorie (tagLimit),
 * extrait borné, colonne image conditionnelle, bouton « En savoir plus » remontant
 * le MÊME onClick que la carte (une seule fois — stopPropagation).
 */
const item = (over: Record<string, unknown> = {}) =>
  ({
    serverData: {
      id: "1",
      name: "Rencontre collective",
      // Sans fuseau : parse LOCAL → l'heure affichée ne dépend pas du TZ du runner.
      startDate: "2026-06-26T08:00:00",
      shortDescription: "Une matinée d'exploration collective autour du pouvoir d'agir.",
      tags: ["Rencontre", "Atelier"],
      ...over,
    },
  }) as unknown as SearchEntity;

describe("CardEventTimeline", () => {
  it("rend titre, heure HH:mm et extrait borné à 3 lignes", () => {
    const { getByText, container } = render(<CardEventTimeline item={item()} />);
    expect(getByText("Rencontre collective")).toBeInTheDocument();
    expect(getByText("08:00")).toBeInTheDocument();
    expect(container.querySelector("p.line-clamp-3")?.textContent).toContain("matinée");
  });

  it("chip catégorie : 1er tag seul par défaut, card.tagLimit en affiche plus", () => {
    const one = render(<CardEventTimeline item={item()} />);
    expect(one.getByText("Rencontre")).toBeInTheDocument();
    expect(one.queryByText("Atelier")).toBeNull();

    const two = render(<CardEventTimeline item={item()} card={{ tagLimit: 2 }} />);
    expect(two.getByText("Atelier")).toBeInTheDocument();
  });

  it("sans heure ni image : pas de ligne horaire, pas de colonne image", () => {
    const { container } = render(
      <CardEventTimeline item={item({ startDate: undefined, tags: [] })} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it("avec image : la colonne affiche est rendue", () => {
    const { container } = render(
      <CardEventTimeline item={item({ profilMediumImageUrl: "https://example.org/flyer.jpg" })} />,
    );
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("« En savoir plus » remonte onClick UNE seule fois (stopPropagation)", () => {
    const onClick = vi.fn();
    const { getByRole } = render(<CardEventTimeline item={item()} onClick={onClick} />);
    fireEvent.click(getByRole("button", { name: /en savoir plus|learn more/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("le clic sur la carte entière ouvre aussi le détail", () => {
    const onClick = vi.fn();
    const { getByText } = render(<CardEventTimeline item={item()} onClick={onClick} />);
    fireEvent.click(getByText("Rencontre collective"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
