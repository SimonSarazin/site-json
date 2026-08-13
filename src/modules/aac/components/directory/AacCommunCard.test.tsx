// @vitest-environment jsdom
import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";
import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

import { AacCommunCard } from "./AacCommunCard";

/**
 * La carte pointe le détail du commun par un `<Link>` : sans contexte de
 * routeur, react-router lève sur `basename`. Le lien reste RÉEL sous le
 * MemoryRouter — on ne mocke pas ce qu'on peut exercer.
 */
const renderCard = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

function card(over: Partial<CommunCard> = {}): CommunCard {
  return {
    id: "a1",
    title: "Une instance peertube des CAE",
    hasTitle: true,
    description: "Partage de vidéo auto-hébergé",
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
 * Ces tests ne vérifient pas « ça a l'air bien » — ils verrouillent les
 * invariants de MISE EN PAGE dont dépend l'alignement de la grille, et qui
 * régressent en silence : rien ne casse, les cartes se décalent simplement les
 * unes par rapport aux autres.
 *
 * Référence : gabarit legacy `federationDesCae_index.js` + `directory.css`.
 */
describe("AacCommunCard — rythme vertical figé", () => {
  it("verrouille la hauteur des zones titre / description / tags", () => {
    const { container } = renderCard(<AacCommunCard commun={card()} />);

    // Hauteurs issues de `directory.css` (1rem = 10px dans le thème CO2) :
    // titre 5.7rem, description 7.2rem, tags 5.8rem.
    expect(container.querySelector(".h-14\\.25")).not.toBeNull();
    expect(container.querySelector(".h-18")).not.toBeNull();
    expect(container.querySelector(".h-14\\.5")).not.toBeNull();
    expect(container.querySelector("article")).toHaveClass("min-h-140");
  });

  it("rend la gouttière de tags même quand le commun n'en a aucun", () => {
    const { container } = renderCard(<AacCommunCard commun={card({ tags: [] })} />);

    // Le legacy y pose un `&nbsp;` : la zone existe toujours, sinon la carte
    // remonte de 58px et se désaligne de ses voisines.
    const gutter = container.querySelector(".h-14\\.5");
    expect(gutter).not.toBeNull();
    expect(gutter?.children.length).toBe(0);
  });

  it("replie les tags au-delà du 2e dans une pastille qui les liste", () => {
    renderCard(<AacCommunCard commun={card({ tags: ["Alpha", "Bêta", "Gamma", "Delta"] })} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bêta")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    expect(screen.getByTitle("Gamma, Delta")).toBeInTheDocument();
  });

  it("réserve la place du montant absent au lieu de replier la carte", () => {
    const { container } = renderCard(<AacCommunCard commun={card({ hasFundingRequest: false })} />);

    // `.collect-empty { height: 44.28px }` — la cale qui garde la barre de
    // progression sur la même ligne d'une carte à l'autre.
    expect(container.querySelector(".h-11\\.07")).not.toBeNull();
    expect(screen.getByText("directory.card.noFunding")).toBeInTheDocument();
  });
});

describe("AacCommunCard — contenu", () => {
  it("retombe sur un libellé plutôt que de laisser la description vide", () => {
    renderCard(<AacCommunCard commun={card({ description: "" })} />);
    expect(screen.getByText("directory.card.noDescription")).toBeInTheDocument();
  });

  it("affiche « 0% » dans la barre — le legacy ne le masque pas", () => {
    renderCard(<AacCommunCard commun={card({ progressPercent: 0 })} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("borne la LARGEUR de la barre à 100 % sans borner le pourcentage affiché", () => {
    renderCard(
      <AacCommunCard
        commun={card({
          progressPercent: 110,
          hasFundingRequest: true,
          totalFunded: 11000,
          totalRequested: 10000,
        })}
      />
    );

    const bar = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(bar.style.width).toBe("100%");
    expect(screen.getByText("110%")).toBeInTheDocument();
  });

  it("formate le montant à la française, sans décimale", () => {
    renderCard(
      <AacCommunCard commun={card({ hasFundingRequest: true, totalFunded: 1656 })} />
    );
    // `toLocaleString("fr-FR")` sépare par U+202F ; `\s` la couvre, tout comme
    // l'espace ordinaire que produit le normaliseur de testing-library.
    expect(screen.getByText(/1\s?656/u)).toBeInTheDocument();
  });
});

describe("AacCommunCard — badge « en attente »", () => {
  it("n'apparaît pas quand la sélection est indécidable", () => {
    renderCard(<AacCommunCard commun={card({ isSelected: null })} />);
    expect(screen.queryByText("directory.card.pending")).not.toBeInTheDocument();
  });

  it("n'apparaît pas pour un commun sélectionné", () => {
    renderCard(<AacCommunCard commun={card({ isSelected: true })} />);
    expect(screen.queryByText("directory.card.pending")).not.toBeInTheDocument();
  });

  it("apparaît et change la bordure de la carte quand non sélectionné", () => {
    const { container } = renderCard(<AacCommunCard commun={card({ isSelected: false })} />);

    expect(screen.getByText("directory.card.pending")).toBeInTheDocument();
    expect(container.querySelector("article")).toHaveClass("border-accent");
  });
});
