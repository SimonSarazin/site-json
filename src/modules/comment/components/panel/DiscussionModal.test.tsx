// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

vi.mock("./DiscussionPanel", () => ({
  // On ne teste pas le panneau ici, mais l'enveloppe : son nom accessible, sa fermeture, et
  // surtout qu'elle rende bien le `headerEnd` qu'on lui confie.
  DiscussionPanel: ({ headerEnd }: { headerEnd?: React.ReactNode }) => (
    <div data-discussion-panel>
      {/* Le champ de recherche du vrai panneau pose cet attribut quand il a quelque chose à
          effacer, le composeur quand il a une édition à annuler. C'est tout ce que la modale
          regarde pour arbitrer Échap : un nœud qui revendique la touche. */}
      <input data-comment-escape data-revendique-echap />
      {headerEnd}
    </div>
  ),
}));

const { DiscussionModal } = await import("./DiscussionModal");

function monter(open = true, onOpenChange = vi.fn()) {
  const utils = render(
    <MemoryRouter>
      <LocalizationProvider>
        <DiscussionModal open={open} onOpenChange={onOpenChange} />
      </LocalizationProvider>
    </MemoryRouter>,
  );
  return { ...utils, onOpenChange };
}

describe("DiscussionModal", () => {
  it("porte un nom accessible sans l'imposer à l'œil", () => {
    monter();
    const boite = screen.getByRole("dialog");
    expect(boite.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("Discussions").className).toContain("sr-only");
  });

  it("se DÉCRIT au lecteur d'écran — la description était escamotée (revue du 29/09)", () => {
    monter();
    const boite = screen.getByRole("dialog");
    const id = boite.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent)
      .toBe("Vos contextes, leurs fils de discussion et les messages du fil choisi.");
  });

  // Le plafond de largeur doit vivre dans une variante qui passe APRÈS `sm:` : posé sans
  // variante, il était écrasé par le `sm:max-w-none` qui retire le `sm:max-w-lg` de la base, et
  // la modale occupait toute la largeur dès 640 px (relevé par une relecture le 07/10, mesuré
  // ensuite sur le CSS de l'application : 1 440 px sur 1 440 au lieu de 1 344).
  it("borne sa largeur à partir de `md`, pas sans variante", () => {
    monter();
    const classes = screen.getByRole("dialog").className.split(/\s+/);
    expect(classes).toContain("md:max-w-[min(84rem,calc(100vw-4rem))]");
    expect(classes).toContain("sm:max-w-none");
    expect(classes).not.toContain("sm:max-w-lg");
    // Aucun plafond sans variante ne doit revenir : il serait mort dès 640 px.
    expect(classes.filter(c => c.startsWith("max-w-[min("))).toEqual([]);
  });

  it("pose sa croix DANS la barre de titre, pas par-dessus l'en-tête du fil", () => {
    monter();
    // Le dialogue est PORTALISÉ : il vit dans `document.body`, jamais dans le conteneur rendu.
    const boite = screen.getByRole("dialog");
    // La croix par défaut de `DialogContent` est en `absolute top-4 right-4`, pile sur
    // l'en-tête du fil : elle est désactivée, et la nôtre passe par `headerEnd`.
    const croix = screen.getByRole("button", { name: /Fermer les discussions/ });
    expect(boite.querySelector("[data-discussion-panel]")!.contains(croix)).toBe(true);
    expect(boite.querySelector('[data-slot="dialog-close"]')).toBeNull();
  });

  it("se ferme à la croix et à Échap", () => {
    const { onOpenChange } = monter();
    fireEvent.click(screen.getByRole("button", { name: /Fermer les discussions/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  /**
   * Radix écoute Échap sur `document` en phase de CAPTURE : un `preventDefault` posé dans un
   * gestionnaire React — qui, lui, bulle — arriverait après que la modale a décidé de se
   * fermer. `onEscapeKeyDown` est le seul point d'accroche, et il tranche sur le DOM plutôt
   * que sur un état partagé, parce que les pièces concernées ne se parlent pas.
   */
  it("laisse Échap à qui le revendique, au lieu de se fermer par-dessus", () => {
    const { onOpenChange } = monter();
    const champ = document.querySelector("[data-revendique-echap]")!;
    fireEvent.keyDown(champ, { key: "Escape" });
    // La modale reste ouverte : c'est au champ d'effacer sa requête d'abord.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  /**
   * Anti-régression du verrou de défilement. Radix `Presence` attend `animationend` avant de
   * démonter ; avec une animation de sortie et un contenu lourd qui se re-rend, cet événement
   * n'arrive jamais : le dialogue reste `state=closed` et `react-remove-scroll` laisse `<body>`
   * verrouillé — la page derrière ne défile plus. C'est le défaut que `dialog.tsx` a corrigé,
   * et que `sheet.tsx` n'a pas reçu ; d'où le choix de `Dialog`.
   */
  it("rend son défilement à la page en se fermant", () => {
    const { rerender } = monter();
    rerender(
      <MemoryRouter>
        <LocalizationProvider>
          <DiscussionModal open={false} onOpenChange={() => {}} />
        </LocalizationProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
