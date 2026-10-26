// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CollapsibleMessage } from "./CollapsibleMessage";
import "../i18n";

const LONG = "Compte rendu du comité de sélection. ".repeat(60);

/**
 * jsdom ne dispose rien : `scrollHeight` et `clientHeight` y valent 0. On les force, ce qui
 * est la seule façon de reproduire « le contenu dépasse la hauteur bornée ».
 */
function simulerHauteur(contenu: number, borne: number) {
  const s = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(contenu);
  const c = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(borne);
  return () => { s.mockRestore(); c.mockRestore(); };
}

const wrap = (ui: React.ReactElement) => render(<LocalizationProvider>{ui}</LocalizationProvider>);

afterEach(() => vi.restoreAllMocks());

describe("CollapsibleMessage", () => {
  it("ne propose rien quand le message tient dans la hauteur", () => {
    simulerHauteur(80, 144);
    const { container } = wrap(<CollapsibleMessage><p>Court</p></CollapsibleMessage>);
    expect(container.querySelector("[data-comment-expand]")).toBeNull();
    expect(container.querySelector("[data-comment-body]")?.getAttribute("data-collapsed")).toBe("false");
  });

  it("replie un message long SANS sortir son texte du DOM", () => {
    simulerHauteur(900, 144);
    const { container } = wrap(<CollapsibleMessage><p>{LONG}</p></CollapsibleMessage>);
    const corps = container.querySelector("[data-comment-body]")!;
    expect(corps.getAttribute("data-collapsed")).toBe("true");
    expect(corps.className).toContain("comment-collapsed");
    // L'exigence qui exclut `-webkit-line-clamp` : le texte entier reste trouvable.
    expect(corps.textContent).toBe(LONG);
    expect(screen.getByRole("button", { name: /Afficher la suite/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("déroule et replie, en annonçant son état", () => {
    simulerHauteur(900, 144);
    const { container } = wrap(<CollapsibleMessage><p>{LONG}</p></CollapsibleMessage>);
    fireEvent.click(screen.getByRole("button", { name: /Afficher la suite/ }));
    const corps = container.querySelector("[data-comment-body]")!;
    expect(corps.getAttribute("data-collapsed")).toBe("false");
    expect(corps.className).not.toContain("comment-collapsed");
    const bouton = screen.getByRole("button", { name: /Réduire/ });
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(bouton);
    expect(screen.getByRole("button", { name: /Afficher la suite/ })).toBeTruthy();
  });

  it("ne replie JAMAIS le message qu'on vient d'envoyer", () => {
    simulerHauteur(900, 144);
    const { container } = wrap(
      <CollapsibleMessage disabled><p>{LONG}</p></CollapsibleMessage>);
    expect(container.querySelector("[data-comment-expand]")).toBeNull();
    expect(container.querySelector(".comment-collapsed")).toBeNull();
  });

  it("ne lève pas là où `ResizeObserver` n'existe pas", () => {
    const sauvegarde = globalThis.ResizeObserver;
    // @ts-expect-error — on simule un environnement qui ne le fournit pas.
    delete globalThis.ResizeObserver;
    try {
      simulerHauteur(900, 144);
      expect(() => wrap(<CollapsibleMessage><p>{LONG}</p></CollapsibleMessage>)).not.toThrow();
      // La mesure du montage suffit : le repli est bien appliqué.
      expect(screen.getByRole("button", { name: /Afficher la suite/ })).toBeTruthy();
    } finally {
      globalThis.ResizeObserver = sauvegarde;
    }
  });
});
