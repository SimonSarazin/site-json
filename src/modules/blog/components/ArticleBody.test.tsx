// @vitest-environment jsdom
/**
 * Corps d'article : markdown ET HTML brut dans le même texte — cas réel d'une actualité reprise de WordPress
 * (« Mois de la parentalité 2026 ») dont le tableau s'affichait en texte `<table border="1"…`.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArticleBody } from "./ArticleBody";

const MIXTE = `# Le Réseau Parentalité 62 organise la 11ème édition

### Pourquoi participer ?

<table border="1" width="907" cellspacing="0" cellpadding="0"><tbody><tr><td valign="top" width="907"><h3>Une proposition départementale pour 2026</h3><p>Participez à <b>« La famille, c’est quoi ? »</b>, voir le <a href="https://drive.google.com/drive/folders/x" target="_blank" rel="noreferrer noopener">Kit <span class="il">Mois</span> de la Parentalité 2026</a></p></td></tr></tbody></table>
`;

describe("ArticleBody", () => {
  it("rend un tableau HTML au milieu du markdown, sans l'afficher en texte", () => {
    const { container } = render(<ArticleBody text={MIXTE} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.textContent).not.toContain("<table");
    expect(screen.getByRole("heading", { level: 3, name: "Une proposition départementale pour 2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kit Mois de la Parentalité 2026/ })).toHaveAttribute("href", "https://drive.google.com/drive/folders/x");
  });

  it("interprète toujours le markdown autour du HTML (titres `#`)", () => {
    render(<ArticleBody text={MIXTE} />);
    expect(screen.getByRole("heading", { level: 1, name: /11ème édition/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Pourquoi participer ?" })).toBeInTheDocument();
  });

  it("neutralise le HTML dangereux et les crochets de mise en page (profil strict)", () => {
    const { container } = render(
      <ArticleBody text={'Texte <script>alert(1)</script><img src=x onerror="alert(2)"><div style="position:fixed;inset:0" class="fixed">voile</div><form action="https://evil"><input type="password"></form>'} />,
    );
    expect(container.querySelector("script, form, input, [onerror], [style], [class*=fixed]")).toBeNull();
  });

  it("ne rend rien pour un corps absent ou vide", () => {
    expect(render(<ArticleBody text={undefined} />).container.innerHTML).toBe("");
    expect(render(<ArticleBody text={"   "} />).container.innerHTML).toBe("");
  });
});
