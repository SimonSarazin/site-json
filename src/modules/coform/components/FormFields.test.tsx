// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProseContent, TitleSeparatorField } from "./FormFields";
import type { FormFieldMapping } from "../types";

/**
 * Non-régression sécurité (XSS) : `ProseContent` rend du contenu admin via
 * `dangerouslySetInnerHTML`, il DOIT passer par `sanitize()` (DOMPurify).
 * Voir `doc/bonnes-pratiques-code.md` §8 + norme #16 de l'agent module-review.
 * Une régression ici = réintroduction d'une faille → ces tests doivent rester verts.
 */
describe("ProseContent — sanitisation XSS", () => {
  it("retire les balises <script> (branche HTML détectée)", () => {
    const { container } = render(
      <ProseContent text={'<p>Bonjour</p><script>window.__pwned = 1;</script>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Bonjour");
  });

  it("retire les handlers inline (onerror) tout en gardant l'élément", () => {
    const { container } = render(
      <ProseContent text={'<img src="x" onerror="window.__pwned = 1">'} />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("onerror")).toBeNull();
  });

  it("neutralise les URLs javascript: dans les liens", () => {
    const { container } = render(
      <ProseContent text={'<a href="javascript:alert(1)">clic</a>'} />,
    );
    const href = container.querySelector("a")?.getAttribute("href");
    expect(href ?? "").not.toMatch(/^javascript:/i);
  });

  it("rend le markdown légitime (pas de balise → branche markdown)", () => {
    const { container } = render(<ProseContent text={"Texte **en gras**"} />);
    expect(container.querySelector("strong")?.textContent).toBe("en gras");
    expect(container.querySelector("script")).toBeNull();
  });

  it("préserve l'HTML inline sûr comme <br/>", () => {
    const { container } = render(<ProseContent text={"Ligne 1<br/>Ligne 2"} />);
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent).toContain("Ligne 1");
    expect(container.textContent).toContain("Ligne 2");
  });

  it("sanitise aussi le markdown forcé (pas de bypass via forceMarkdown)", () => {
    const { container } = render(
      <ProseContent text={'**ok** <script>window.__pwned = 1;</script>'} forceMarkdown />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("ok");
  });
});

describe("TitleSeparatorField", () => {
  const sep = (over: Partial<FormFieldMapping> = {}) =>
    ({
      name: "aapStep1m0dia6b7r0panzlwqvk",
      label: "Le commun",
      type: "tpls.forms.titleSeparator",
      componentType: "titleSeparator",
      isRequired: false,
      ...over,
    }) as FormFieldMapping;

  it("rend le titre du séparateur", () => {
    const { container } = render(<TitleSeparatorField field={sep()} />);
    expect(container.querySelector("h2")?.textContent).toBe("Le commun");
  });

  it("n'affiche AUCUN astérisque même marqué requis", () => {
    // 57 des 78 séparateurs du parc portent `isRequired: true` alors qu'ils ne
    // demandent rien : afficher un astérisque promettrait une saisie qui
    // n'existe pas.
    const { container } = render(<TitleSeparatorField field={sep({ isRequired: true })} />);
    expect(container.textContent).not.toContain("*");
  });

  it("rend l'info quand elle existe", () => {
    const { container } = render(<TitleSeparatorField field={sep({ info: "Une précision" })} />);
    expect(container.textContent).toContain("Une précision");
  });
});
