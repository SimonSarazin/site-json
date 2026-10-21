// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { CommentTarget, SpaceRef } from "../../types";
import { ECHO_WINDOW_MS } from "../../lib/echoClick";

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
  it("ni elle ni sa coquille n'importent le panneau général", () => {
    // Sa coquille vivait dans le fichier de la modale générale, qui importe ce panneau — le morceau
    // de l'espace le téléchargeait donc pour rien, à chaque première ouverture. Le panneau de
    // l'espace est doublé ici : son graphe à lui est suivi dans `editorGraph.test.ts`.
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

  // Ouverte depuis un formulaire général, l'espace n'est pas celui d'un commun : celui de la RÉPONSE.
  it("l'espace d'une réponse à un formulaire général se nomme et se décrit comme tel — et le panneau le sait", () => {
    monter({ title: null, subject: "answer" });
    const boite = screen.getByRole("dialog");
    expect(document.getElementById(boite.getAttribute("aria-labelledby")!)!.textContent).toBe("Discussions de la réponse");
    expect(document.getElementById(boite.getAttribute("aria-describedby")!)!.textContent)
      .toBe("Les fils de discussion de cette réponse et les messages du fil choisi.");
    expect(recu.props).toMatchObject({ subject: "answer" });
  });

  it("titrée, une réponse se nomme d'après son titre, comme un commun", () => {
    monter({ title: "Diagnostic 2026", subject: "answer" });
    const boite = screen.getByRole("dialog");
    expect(document.getElementById(boite.getAttribute("aria-labelledby")!)!.textContent).toBe("Discussions — Diagnostic 2026");
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

/**
 * L'écho d'un double clic (relecture du 13/10, mesuré au navigateur : douze doubles clics sur douze
 * refermaient la modale). La coquille l'avale aux deux moments où elle change ce qu'il y a sous le
 * curseur : quand elle apparaît, et quand un clic la ferme. jsdom n'a pas de mise en page : on
 * rejoue le SECOND clic là où il tomberait.
 */
describe("SpaceModal — l'écho d'un double clic", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  // Les fenêtres encore ouvertes se referment AVANT de rendre les vraies horloges : abandonnée
  // avec son minuteur, une garde resterait sur le document et avalerait les clics du test suivant.
  afterEach(() => {
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });

  const voile = () => document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
  const croix = () => screen.getByRole("button", { name: /Fermer les discussions/ });
  /** Un bouton de la page, là où la modale n'est plus. */
  function boutonDeLaPage() {
    const bouton = document.createElement("button");
    document.body.append(bouton);
    const clic = vi.fn();
    bouton.addEventListener("click", clic);
    return { bouton, clic };
  }
  const passeLaFenetre = () => act(() => { vi.advanceTimersByTime(ECHO_WINDOW_MS); });

  it("à l'ouverture : le second clic n'atteint pas ce qui est venu sous le curseur ; un premier clic, si", () => {
    monter();
    const champ = document.querySelector<HTMLElement>("[data-revendique-echap]")!;
    const clic = vi.fn();
    champ.addEventListener("click", clic);
    fireEvent.click(champ, { detail: 2 });
    expect(clic).not.toHaveBeenCalled();
    fireEvent.click(champ, { detail: 1 });
    expect(clic).toHaveBeenCalledTimes(1);
    // Passé la fenêtre, un double clic dans la modale est un double clic comme un autre.
    passeLaFenetre();
    fireEvent.click(champ, { detail: 2 });
    expect(clic).toHaveBeenCalledTimes(2);
  });

  it("à l'ouverture : le second appui ne tombe pas sur le voile — la modale ne se referme pas aussitôt", () => {
    const { onOpenChange } = monter();
    // Radix n'écoute les appuis extérieurs qu'au tour suivant son montage.
    act(() => { vi.advanceTimersByTime(1); });
    fireEvent.pointerDown(voile(), { clientX: 30, clientY: 500 });
    expect(onOpenChange).not.toHaveBeenCalled();
    // Témoin : passé la fenêtre, le même appui ferme bien.
    passeLaFenetre();
    fireEvent.pointerDown(voile(), { clientX: 30, clientY: 500 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fermée avant la fin de la fenêtre, elle désarme : la page retrouve ses doubles clics", () => {
    const { unmount } = monter();
    unmount();
    const { bouton, clic } = boutonDeLaPage();
    fireEvent.click(bouton, { detail: 2 });
    expect(clic).toHaveBeenCalledTimes(1);
    bouton.remove();
  });

  it("à la croix : le second clic, au même endroit, n'atteint pas la page que la modale couvrait", () => {
    const { onOpenChange } = monter();
    passeLaFenetre();
    const { bouton, clic } = boutonDeLaPage();
    fireEvent.click(croix(), { detail: 1, clientX: 900, clientY: 40 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(bouton, { detail: 2, clientX: 903, clientY: 42 });
    expect(clic).not.toHaveBeenCalled();
    // Ailleurs, la page répond — et au même endroit aussi, la fenêtre passée.
    fireEvent.click(bouton, { detail: 2, clientX: 300, clientY: 300 });
    expect(clic).toHaveBeenCalledTimes(1);
    passeLaFenetre();
    fireEvent.click(bouton, { detail: 2, clientX: 903, clientY: 42 });
    expect(clic).toHaveBeenCalledTimes(2);
    bouton.remove();
  });

  it("à la croix, au CLAVIER : rien n'est armé — il n'y a pas de second appui", () => {
    const { onOpenChange } = monter();
    passeLaFenetre();
    const { bouton, clic } = boutonDeLaPage();
    // Une activation au clavier arrive en `click` de `detail` nul, sans coordonnées.
    fireEvent.click(croix(), { detail: 0, clientX: 0, clientY: 0 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(bouton, { detail: 2, clientX: 0, clientY: 0 });
    expect(clic).toHaveBeenCalledTimes(1);
    bouton.remove();
  });

  it("au voile : l'appui qui ferme arme la garde à CET endroit", () => {
    const { onOpenChange } = monter();
    passeLaFenetre();
    const { bouton, clic } = boutonDeLaPage();
    fireEvent.pointerDown(voile(), { clientX: 30, clientY: 500 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(bouton, { detail: 2, clientX: 32, clientY: 498 });
    expect(clic).not.toHaveBeenCalled();
    fireEvent.click(bouton, { detail: 2, clientX: 700, clientY: 100 });
    expect(clic).toHaveBeenCalledTimes(1);
    bouton.remove();
  });
});
