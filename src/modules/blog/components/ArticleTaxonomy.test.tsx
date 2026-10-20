// @vitest-environment jsdom
/**
 * Pied de lecture d'article : territoires/publics (étiquetés) et mots-clés (sans étiquette, rendu
 * historique) — chaque groupe optionnel. Protège surtout la dégradation gracieuse : un site qui n'a
 * que des `tags` (pas de `territoires`/`publics` sur son POI) ne doit voir AUCUNE étiquette vide.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArticleTaxonomy } from "./ArticleTaxonomy";
import type { ArticleData } from "../hooks/useArticle";

vi.mock("@/hooks/useT", () => ({ useT: () => (k: string) => k.replace("article.", "") }));

describe("ArticleTaxonomy", () => {
  it("affiche les trois groupes (territoires, publics, mots-clés) quand les trois sont présents", () => {
    const article: ArticleData = { territoires: ["Arrageois"], publics: ["Bénévoles", "En famille"], tags: ["Actus"] };
    render(<ArticleTaxonomy article={article} />);
    expect(screen.getByText("territories")).toBeInTheDocument();
    expect(screen.getByText("Arrageois")).toBeInTheDocument();
    expect(screen.getByText("audiences")).toBeInTheDocument();
    expect(screen.getByText("Bénévoles")).toBeInTheDocument();
    expect(screen.getByText("En famille")).toBeInTheDocument();
    expect(screen.getByText("Actus")).toBeInTheDocument();
  });

  it("masque un groupe vide sans afficher son étiquette (site qui n'a que des tags)", () => {
    render(<ArticleTaxonomy article={{ tags: ["Actus"] }} />);
    expect(screen.queryByText("territories")).not.toBeInTheDocument();
    expect(screen.queryByText("audiences")).not.toBeInTheDocument();
    expect(screen.getByText("Actus")).toBeInTheDocument();
  });

  it("ne rend rien (pas même le conteneur) quand les trois groupes sont vides", () => {
    const { container } = render(<ArticleTaxonomy article={{}} />);
    expect(container.innerHTML).toBe("");
  });

  it("ignore les valeurs non-chaînes glissées dans un tableau (donnée backend non garantie)", () => {
    const article = { territoires: ["Arrageois", 42, null] } as unknown as ArticleData;
    render(<ArticleTaxonomy article={article} />);
    expect(screen.getByText("Arrageois")).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });
});
