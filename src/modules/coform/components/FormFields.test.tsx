// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

import { FieldLabel, ProseContent } from "./FormFields";
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

/**
 * `FieldLabel` est le POINT UNIQUE de rendu du libellé des champs du module.
 * Le garde-fou qui vérifie qu'AUCUN champ n'y échappe vit dans
 * `tests/preflight/coform-field-label.test.ts` (un merge a déjà réintroduit la
 * copie inline sur deux champs neufs, avec tous les gates au vert).
 * Une régression ici se propage à tout le formulaire, d'où ces tests.
 */
describe("FieldLabel", () => {
  const champ = (over: Partial<FormFieldMapping> = {}) =>
    ({ name: "q1", label: "Ma question", isRequired: false, ...over }) as FormFieldMapping;

  it("rend un <label for> quand une cible est fournie", () => {
    const { container } = render(<FieldLabel field={champ()} htmlFor="q1" />);
    const label = container.querySelector("label");
    expect(label?.getAttribute("for")).toBe("q1");
    expect(label?.textContent).toContain("Ma question");
  });

  it("rend une <div> sans cible — un <label> sans `for` ne nomme rien", () => {
    const { container } = render(<FieldLabel field={champ()} id="q1-label" />);
    expect(container.querySelector("label")).toBeNull();
    expect(container.querySelector("div")?.getAttribute("id")).toBe("q1-label");
  });

  it("annonce « obligatoire » aux lecteurs d'écran, pas « étoile »", () => {
    const { container } = render(<FieldLabel field={champ({ isRequired: true })} />);
    const etoile = container.querySelector('[aria-hidden="true"]');
    expect(etoile?.textContent).toBe("*");
    expect(container.querySelector(".sr-only")?.textContent).toBe("obligatoire");
  });

  it("n'annonce rien de tel quand le champ n'est pas requis", () => {
    const { container } = render(<FieldLabel field={champ()} />);
    expect(container.querySelector(".sr-only")).toBeNull();
    expect(container.textContent).toBe("Ma question");
  });

  it("distingue la question du contenu par la taille ET la graisse", () => {
    // Le contenu des champs est en `text-sm` : sans cet écart les deux niveaux
    // se confondent, ce qui était le défaut d'origine.
    const { container } = render(<FieldLabel field={champ()} />);
    const cls = container.firstElementChild?.className ?? "";
    expect(cls).toContain("text-base");
    expect(cls).toContain("font-semibold");
  });

  it("passe en rouge en état d'erreur", () => {
    const { container } = render(<FieldLabel field={champ()} hasError />);
    expect(container.firstElementChild?.className).toContain("text-destructive");
  });

  it("ne rend rien sans libellé", () => {
    const { container } = render(<FieldLabel field={champ({ label: "" })} />);
    expect(container.innerHTML).toBe("");
  });
});
