// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CommentTarget, SpaceRef } from "../../types";

// ⚠️ PAS d'import de `../../i18n` ici, et c'est voulu : la modale se charge en différé, par son
// propre fichier — c'est à ELLE d'enregistrer ses libellés. Les phrases attendues plus bas en sont
// la preuve : sans cet enregistrement, elles sortiraient en clés brutes.

/** Ce que la modale a confié au panneau, au dernier rendu. */
const recu: { props: Record<string, unknown> | null } = { props: null };

vi.mock("./SpacePanel", () => ({
  // On ne teste pas le panneau ici, mais l'enveloppe : son nom, sa largeur, sa fermeture, et ce
  // qu'elle transmet — dont la croix, que le panneau pose dans SA barre de titre.
  SpacePanel: (props: { headerEnd?: ReactNode } & Record<string, unknown>) => {
    recu.props = props;
    return (
      <div data-space-panel>
        <input data-comment-escape data-revendique-echap />
        {props.headerEnd}
      </div>
    );
  },
}));

// Le panneau GÉNÉRAL n'est pas rendu par cette modale. On compte seulement s'il est CHARGÉ avec
// elle : la fabrique d'un module remplacé ne tourne qu'au premier import de ce module.
const general = { chargements: 0 };
vi.mock("./DiscussionPanel", () => {
  general.chargements += 1;
  return { DiscussionPanel: () => null };
});

const { SpaceModal, default: parDefaut } = await import("./SpaceModal");

const COMMUN = "65c3000000000000000000c1";
const ESPACE: SpaceRef = { type: "answers", id: COMMUN };
const GENERAL: CommentTarget = { type: "answers", id: COMMUN, path: null };

function monter(props: Partial<Parameters<typeof SpaceModal>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <LocalizationProvider>
      <SpaceModal open onOpenChange={onOpenChange} space={ESPACE} target={null} onSelect={onSelect} {...props} />
    </LocalizationProvider>,
  );
  return { ...utils, onOpenChange, onSelect };
}

describe("SpaceModal", () => {
  it("n'emporte pas le panneau général : elle se charge en différé, et ne le rend jamais", () => {
    // Sa coquille vivait dans le fichier de la modale générale, qui importe ce panneau — le morceau
    // de l'espace le téléchargeait donc pour rien, à chaque première ouverture.
    expect(general.chargements).toBe(0);
  });

  it("à l'ouverture, pose le focus sur le dialogue — pas sur son premier bouton, ni sur la croix", () => {
    // Au rendu d'ouverture la liste des fils n'est pas encore là : le premier élément atteignable
    // serait la croix, et l'on ouvrirait, au clavier, sur « Fermer ».
    monter();
    const boite = screen.getByRole("dialog");
    expect(document.activeElement).toBe(boite);
    expect(boite.contains(document.querySelector("[data-revendique-echap]"))).toBe(true);
  });

  it("se nomme d'après le commun, sans imposer ce nom à l'œil", () => {
    monter({ title: "Une instance peertube" });
    const boite = screen.getByRole("dialog");
    const titre = document.getElementById(boite.getAttribute("aria-labelledby")!)!;
    expect(titre.textContent).toBe("Discussions — Une instance peertube");
    // Le panneau porte déjà ses titres de colonnes : celui-ci est pour le lecteur d'écran.
    expect(titre.className).toContain("sr-only");
  });

  it("garde un nom quand le commun n'a pas de titre", () => {
    monter({ title: null });
    const boite = screen.getByRole("dialog");
    expect(document.getElementById(boite.getAttribute("aria-labelledby")!)!.textContent).toBe("Discussions du commun");
  });

  it("se décrit au lecteur d'écran", () => {
    monter();
    const boite = screen.getByRole("dialog");
    expect(document.getElementById(boite.getAttribute("aria-describedby")!)!.textContent)
      .toBe("Les fils de discussion de ce commun et les messages du fil choisi.");
  });

  // Deux colonnes au lieu de trois : un fil n'a rien à gagner à s'étirer sur 84 rem. Le plafond doit
  // REMPLACER celui de la coquille, et vivre comme lui dans une variante qui passe après `sm:` —
  // posé sans variante, il perdrait contre le `sm:max-w-none` qui retire le `sm:max-w-lg` de la base.
  it("borne sa largeur à 64 rem à partir de `md`, à la place du plafond de la coquille", () => {
    monter();
    const classes = screen.getByRole("dialog").className.split(/\s+/);
    expect(classes).toContain("md:max-w-[min(64rem,calc(100vw-4rem))]");
    expect(classes).not.toContain("md:max-w-[min(84rem,calc(100vw-4rem))]");
    expect(classes).toContain("sm:max-w-none");
    expect(classes.filter(c => c.startsWith("max-w-[min("))).toEqual([]);
  });

  it("confie au panneau l'espace, le titre, le fil ouvert, de quoi en changer et l'entité des mentions", () => {
    const entite = { id: "orga-de-l-appel" } as unknown as EntityTypes;
    const { onSelect } = monter({ title: "Une instance peertube", target: GENERAL, scopeEntity: entite });
    expect(recu.props).toMatchObject({
      space: ESPACE, title: "Une instance peertube", target: GENERAL, onSelect, scopeEntity: entite,
    });
  });

  it("pose sa croix DANS le panneau, pas par-dessus l'en-tête du fil", () => {
    monter();
    const boite = screen.getByRole("dialog");
    const croix = screen.getByRole("button", { name: /Fermer les discussions/ });
    expect(boite.querySelector("[data-space-panel]")!.contains(croix)).toBe(true);
    expect(boite.querySelector('[data-slot="dialog-close"]')).toBeNull();
  });

  it("se ferme à la croix et à Échap — et ne touche pas à la sélection", () => {
    const { onOpenChange, onSelect } = monter({ target: GENERAL });
    fireEvent.click(screen.getByRole("button", { name: /Fermer les discussions/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Fermer est le verbe de l'hôte : c'est lui qui décide de ce que devient l'adresse.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("laisse Échap à qui le revendique — le composer qui annule une édition, par exemple", () => {
    const { onOpenChange } = monter();
    fireEvent.keyDown(document.querySelector("[data-revendique-echap]")!, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("s'exporte aussi par défaut — c'est ce que charge l'import différé de la fiche", () => {
    expect(parDefaut).toBe(SpaceModal);
  });

  it("fermée, ne rend ni boîte ni panneau", () => {
    recu.props = null;
    monter({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(recu.props).toBeNull();
  });
});
