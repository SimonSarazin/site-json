// @vitest-environment jsdom
import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";
import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

import { AacCommunRow } from "./AacCommunRow";

/** Même contrainte que la carte : le titre est un `<Link>`. */
const renderRow = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

function commun(over: Partial<CommunCard> = {}): CommunCard {
  return {
    id: "a1",
    title: "Yeswiki",
    hasTitle: true,
    description: "Wiki coopératif",
    tags: [],
    maturity: null,
    imageUrl: null,
    funds: [],
    totalRequested: 0,
    totalFunded: 0,
    progressPercent: 0,
    hasFundingRequest: false,
    usersCount: 1,
    interestCount: 1,
    isSelected: null,
    usage: EMPTY_AAC_USAGE,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/**
 * La ligne rend les mêmes FAITS que la carte : c'est l'invariant à tenir. Une
 * information qui n'existerait que dans un mode ferait de la bascule un choix
 * fonctionnel, alors qu'elle ne doit être qu'un choix de lecture.
 */
describe("AacCommunRow — les faits de l'AAC", () => {
  it("rend titre, description, membres et intéressés", () => {
    renderRow(<AacCommunRow commun={commun({ usersCount: 3, interestCount: 2 })} />);

    expect(screen.getByText("Yeswiki")).toBeInTheDocument();
    expect(screen.getByText("Wiki coopératif")).toBeInTheDocument();
    expect(screen.getByText(/^3 directory\.card\.users$/)).toBeInTheDocument();
    expect(screen.getByText(/^2 directory\.card\.interested_other$/)).toBeInTheDocument();
  });

  it("accorde membres et intéressés au singulier", () => {
    renderRow(<AacCommunRow commun={commun({ usersCount: 1, interestCount: 1 })} />);

    expect(screen.getByText(/^1 directory\.card\.user$/)).toBeInTheDocument();
    expect(screen.getByText(/^1 directory\.card\.interested_one$/)).toBeInTheDocument();
  });

  it("formate le montant à la française, sans décimale", () => {
    renderRow(
      <AacCommunRow
        commun={commun({ hasFundingRequest: true, totalFunded: 1656, progressPercent: 45 })}
      />
    );

    // `toLocaleString("fr-FR")` sépare par U+202F ; `\s` la couvre, tout comme
    // l'espace ordinaire que produit le normaliseur de testing-library.
    expect(screen.getByText(/1\s?656/u)).toBeInTheDocument();
  });

  it("borne la LARGEUR de la barre sans borner le pourcentage annoncé", () => {
    renderRow(
      <AacCommunRow commun={commun({ hasFundingRequest: true, progressPercent: 110 })} />
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "110");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("100%");
  });

  it("tient la colonne de collecte quand il n'y a pas de demande", () => {
    // Sans cale, les lignes sans cofinancement remonteraient et la colonne de
    // montants ne se lirait plus d'un trait.
    renderRow(<AacCommunRow commun={commun({ hasFundingRequest: false })} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTitle("directory.card.noFunding")).toBeInTheDocument();
  });

  it("replie les tags au-delà du 2e derrière une pastille qui les révèle", async () => {
    // Même rang de repli ET même affordance que la carte : un commun se lit
    // pareil dans les deux modes.
    renderRow(<AacCommunRow commun={commun({ tags: ["Alpha", "Bêta", "Gamma", "Delta"] })} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bêta")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /showMoreTags/ }));
    expect(await screen.findByText("Gamma")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();
  });
});

describe("AacCommunRow — densité et états", () => {
  it("tronque titre et description sur une seule ligne chacun", () => {
    // L'invariant du mode liste : deux lignes de texte par commun, jamais trois.
    const { container } = renderRow(<AacCommunRow commun={commun()} />);

    expect(container.querySelector("h3")).toHaveClass("truncate");
    expect(container.querySelector("p")).toHaveClass("truncate");
  });

  it("porte la description ENTIÈRE en `title`, puisque l'affichage tronque", () => {
    const long = "Une description bien plus longue que la place disponible sur la ligne";
    renderRow(<AacCommunRow commun={commun({ description: long })} />);

    expect(screen.getByTitle(long)).toBeInTheDocument();
  });

  it("retombe sur un libellé plutôt que de laisser la description vide", () => {
    renderRow(<AacCommunRow commun={commun({ description: "" })} />);
    expect(screen.getByText("directory.card.noDescription")).toBeInTheDocument();
  });

  it("signale « en attente » et change la bordure quand non sélectionné", () => {
    const { container } = renderRow(<AacCommunRow commun={commun({ isSelected: false })} />);

    expect(screen.getByText("directory.card.pending")).toBeInTheDocument();
    expect(container.querySelector("article")).toHaveClass("border-accent");
  });

  it("n'affiche pas de badge quand la sélection est indécidable", () => {
    renderRow(<AacCommunRow commun={commun({ isSelected: null })} />);
    expect(screen.queryByText("directory.card.pending")).not.toBeInTheDocument();
  });

  it("retombe sur le libellé « sans titre » plutôt que sur une ligne muette", () => {
    renderRow(<AacCommunRow commun={commun({ hasTitle: false, title: "" })} />);
    expect(screen.getByText("directory.card.untitled")).toBeInTheDocument();
  });
});
