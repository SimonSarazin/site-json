// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { useSpaceLauncher, type SpaceLauncher } from "./useSpaceLauncher";
import type { CommentTarget, SpaceRef } from "../types";

/**
 * Le lanceur de l'espace d'un commun : ce que la fiche sait de sa modale.
 *
 * Ce que cette suite garantit, et qui ne se voit pas à la lecture :
 *   - `?discussion=…` appartient à tout le site : seule une adresse qui désigne un fil DE CET
 *     espace ouvre la modale, et la fermer n'efface jamais l'adresse d'une autre discussion ;
 *   - revenir à la liste des fils ne ferme rien, alors que l'adresse ne désigne plus aucun fil —
 *     et cet état suit « retour » et « suivant », parce qu'il vit dans l'entrée d'historique ;
 *   - fermer DÉFAIT l'ouverture : après la croix, « retour » ramène à la page d'avant la fiche, et
 *     non à la modale (arbitré le 09/10) ;
 *   - un ordre répété avant que l'adresse n'arrive — deux touchers, deux Échap — ne compte qu'une fois.
 *
 * Même précaution que pour `useDiscussionUrlState` : `MemoryRouter` tient son historique en
 * interne, on recule et on avance par `useNavigate`, jamais par `window.history`.
 */

const COMMUN = "65c3000000000000000000c1";
const AUTRE_COMMUN = "65c3000000000000000000c2";
const APPEL = "65c3000000000000000000f1";
const ETAPE = "65c3000000000000000000e1";
const ORG = "65a1000000000000000000a1";

const ESPACE: SpaceRef = { type: "answers", id: COMMUN };
const GENERAL: CommentTarget = { type: "answers", id: COMMUN, path: null };
const CHEMIN = `${APPEL}.${ETAPE}.${COMMUN}.titre.question_titre.comment`;
const QUESTION: CommentTarget = { type: "forms", id: APPEL, path: CHEMIN };
const FICHE = `/aac/commun/${COMMUN}`;

interface Banc {
  readonly lanceur: () => SpaceLauncher;
  /** La valeur du paramètre dans l'adresse courante, décodée ; `null` s'il est absent. */
  readonly param: (nom?: string) => string | null;
  readonly chemin: () => string;
  /** Ce que l'entrée d'historique courante retient (`location.state`). */
  readonly etat: () => unknown;
  /** L'identité de l'entrée courante : elle change à TOUTE navigation, même vers la même adresse. */
  readonly entree: () => string;
  readonly reculer: () => Promise<void>;
  readonly avancer: () => Promise<void>;
  /** Une navigation qui n'est ni une ouverture ni une traversée — une ancre du sommaire, par exemple. */
  readonly aller: (vers: { readonly hash: string }) => Promise<void>;
  /**
   * `open` à chaque rendu, dans l'ordre. Le PREMIER est celui d'avant les effets : `lanceur()` ne
   * le montre plus (il rend le dernier), alors que c'est lui que l'écran affiche d'abord.
   */
  readonly rendus: readonly boolean[];
}

type Entree = string | { readonly pathname: string; readonly search?: string; readonly state?: unknown };

function monter(url: Entree = FICHE, options?: { readonly param?: string }, historique: readonly Entree[] = []): Banc {
  const rendus: boolean[] = [];
  const { result } = renderHook(
    () => {
      const lanceur = useSpaceLauncher(ESPACE, options);
      rendus.push(lanceur.open);
      return { lanceur, naviguer: useNavigate(), location: useLocation() };
    },
    { wrapper: ({ children }) => <MemoryRouter initialEntries={[...historique, url]}>{children}</MemoryRouter> },
  );
  const traverser = (pas: number) => async () => { await act(async () => { result.current.naviguer(pas); }); };
  return {
    lanceur: () => result.current.lanceur,
    param: (nom = "discussion") => new URLSearchParams(result.current.location.search).get(nom),
    chemin: () => result.current.location.pathname,
    etat: () => result.current.location.state,
    entree: () => result.current.location.key,
    reculer: traverser(-1),
    avancer: traverser(1),
    aller: async vers => { await act(async () => { result.current.naviguer(vers); }); },
    rendus,
  };
}

/** La marque que le lanceur range dans une entrée, pour un espace donné. */
const marque = (space: string, plus: Record<string, unknown> = {}) => ({ commentSpace: { space, ...plus } });
const CLE = `answers:${COMMUN}`;
const TROP_LONG: CommentTarget = { type: "forms", id: APPEL, path: `${CHEMIN}.${"x".repeat(260)}` };
// L'adresse rogne les espaces de bout de valeur : ce chemin-là se relirait SANS la sienne — un autre fil.
const RELU_AUTREMENT: CommentTarget = { type: "forms", id: APPEL, path: `${CHEMIN} ` };
const AILLEURS: CommentTarget = { type: "answers", id: AUTRE_COMMUN, path: null };

describe("useSpaceLauncher — ce que dit l'adresse", () => {
  it("reste fermé quand l'adresse ne dit rien", () => {
    const b = monter();
    expect(b.lanceur().open).toBe(false);
    expect(b.lanceur().target).toBeNull();
  });

  it("ouvre AU PREMIER RENDU sur le fil général que l'adresse désigne", () => {
    // `open` est dérivé au rendu : posé dans un effet, il n'arriverait qu'au rendu suivant — la
    // modale clignoterait sur un lien partagé. C'est donc le premier rendu qu'on regarde, pas le dernier.
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`);
    expect(b.rendus[0]).toBe(true);
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(GENERAL);
  });

  it("ouvre sur un fil de l'appel dont le chemin porte ce commun", () => {
    const b = monter(`${FICHE}?discussion=forms:${APPEL}:${CHEMIN}`);
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(QUESTION);
  });

  it.each([
    ["le fil d'un autre commun", `answers:${AUTRE_COMMUN}`],
    ["un fil de l'appel rangé chez un autre commun", `forms:${APPEL}:${CHEMIN.replace(COMMUN, AUTRE_COMMUN)}`],
    ["le fil racine de l'appel", `forms:${APPEL}`],
    ["une actualité", `news:${ORG}`],
    ["un porteur du panneau général", `@organizations:${ORG}`],
    ["tout le parc", "all"],
    ["une valeur illisible", "n-importe-quoi"],
  ])("n'ouvre pas pour %s — l'adresse appartient à tout le site", (_cas, valeur) => {
    const b = monter(`${FICHE}?discussion=${valeur}`);
    expect(b.lanceur().open).toBe(false);
    expect(b.lanceur().target).toBeNull();
  });

  it("honore un nom de paramètre différent, et ignore alors le nom par défaut", () => {
    const b = monter(`${FICHE}?fil=answers:${COMMUN}`, { param: "fil" });
    expect(b.lanceur().open).toBe(true);

    const defaut = monter(`${FICHE}?discussion=answers:${COMMUN}`, { param: "fil" });
    expect(defaut.lanceur().open).toBe(false);
  });
});

describe("useSpaceLauncher — ce que dit l'entrée d'historique", () => {
  it("rouvre sur la LISTE une entrée qui le retient — un rechargement, un « suivant » —, dès le premier rendu", () => {
    const b = monter({ pathname: FICHE, state: marque(CLE, { list: true }) });
    expect(b.rendus[0]).toBe(true);
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toBeNull();
  });

  it.each([
    ["la marque d'un AUTRE espace", marque(`answers:${AUTRE_COMMUN}`, { list: true })],
    ["une marque sans la liste", marque(CLE, { pushed: true })],
    ["une valeur approchante", marque(CLE, { list: "oui" })],
    ["une marque qui n'est pas un objet", { commentSpace: "liste" }],
    ["un état qui n'est pas un objet", "liste"],
  ])("n'ouvre pas sur %s", (_cas, state) => {
    expect(monter({ pathname: FICHE, state }).lanceur().open).toBe(false);
  });
});

describe("useSpaceLauncher — ouvrir et changer de fil", () => {
  it("`openAt()` ouvre sur le fil général et l'écrit dans l'adresse", () => {
    const b = monter();
    act(() => b.lanceur().openAt());
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(GENERAL);
    expect(b.param()).toBe(`answers:${COMMUN}`);
  });

  it("`openAt(cible)` ouvre sur le fil donné", () => {
    const b = monter();
    act(() => b.lanceur().openAt(QUESTION));
    expect(b.lanceur().target).toEqual(QUESTION);
    expect(b.param()).toBe(`forms:${APPEL}:${CHEMIN}`);
  });

  /**
   * Un fil que l'adresse ne saurait pas relire — plus de 256 caractères, quand le plus long chemin
   * réel en fait 191 — ou qui n'est pas de cet espace n'ouvrirait rien : l'écrire laisserait dans
   * l'adresse un paramètre que plus rien ne sait lire, et une entrée de plus dans l'historique.
   */
  it.each([
    ["que l'adresse ne saurait pas relire", TROP_LONG],
    ["que l'adresse relirait autrement", RELU_AUTREMENT],
    ["d'un autre espace", AILLEURS],
  ])("`openAt` d'un fil %s n'écrit rien : ni adresse, ni entrée", async (_cas, cible) => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt(cible));
    expect(b.lanceur().open).toBe(false);
    expect(b.param()).toBeNull();
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("`select(cible)` change de fil sans fermer", () => {
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`);
    act(() => b.lanceur().select(QUESTION));
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(QUESTION);
  });

  it("`select(null)` revient à la liste : plus de fil dans l'adresse, et la modale RESTE ouverte", () => {
    // Le cas d'une modale ouverte par lien profond : rien ne la tenait ouverte que l'adresse.
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`);
    act(() => b.lanceur().select(null));
    expect(b.param()).toBeNull();
    expect(b.lanceur().target).toBeNull();
    expect(b.lanceur().open).toBe(true);
  });

  it.each([
    ["que l'adresse ne saurait pas relire", TROP_LONG],
    ["que l'adresse relirait autrement", RELU_AUTREMENT],
    ["d'un autre espace", AILLEURS],
  ])("`select` d'un fil %s ne FERME pas la modale : on reste sur le fil ouvert", (_cas, cible) => {
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`);
    act(() => b.lanceur().select(cible));
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(GENERAL);
    expect(b.param()).toBe(`answers:${COMMUN}`);
  });

  it("garde les AUTRES paramètres de l'adresse", () => {
    const b = monter(`${FICHE}?onglet=budget`);
    act(() => b.lanceur().openAt());
    expect(b.param("onglet")).toBe("budget");
    act(() => b.lanceur().select(null));
    expect(b.param("onglet")).toBe("budget");
  });

  it("garde ce que d'AUTRES ont rangé dans l'entrée d'historique, et n'y laisse rien en fermant", () => {
    const b = monter({ pathname: FICHE, search: `?discussion=answers:${COMMUN}`, state: { from: "/login" } });
    act(() => b.lanceur().select(null));
    expect(b.etat()).toEqual({ from: "/login", ...marque(CLE, { list: true }) });
    act(() => b.lanceur().select(QUESTION));
    expect(b.etat()).toEqual({ from: "/login" });
    act(() => b.lanceur().select(null));
    act(() => b.lanceur().close());
    expect(b.etat()).toEqual({ from: "/login" });
  });

  it("choisir un fil depuis la liste retire la marque « sur la liste » — elle ne survit pas à l'adresse", () => {
    const b = monter();
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(null));
    expect(b.etat()).toEqual(marque(CLE, { pushed: true, list: true }));
    act(() => b.lanceur().select(QUESTION));
    // Restée là, elle rouvrirait la modale sur la liste le jour où l'adresse ne désigne plus ce fil.
    expect(b.etat()).toEqual(marque(CLE, { pushed: true }));
  });

  /**
   * Le bouton d'une fiche reste cliquable tant que le code de la modale n'est pas arrivé : arrivé
   * par le lien d'un fil, on clique « Discussion » parce que rien ne s'affiche encore. Répondre par
   * le fil général REMPLAÇAIT le fil du lien — il n'était plus nulle part, pas même dans l'historique.
   */
  it("`openAt()` sans fil, sur un espace déjà ouvert par un lien : rien ne bouge — ni le fil, ni l'entrée", () => {
    const b = monter(`${FICHE}?discussion=forms:${APPEL}:${CHEMIN}`, undefined, ["/aac"]);
    const entree = b.entree();
    act(() => b.lanceur().openAt());
    expect(b.lanceur().target).toEqual(QUESTION);
    expect(b.param()).toBe(`forms:${APPEL}:${CHEMIN}`);
    expect(b.entree()).toBe(entree);
  });

  it("… et sur un espace ouvert sur sa LISTE : on reste sur la liste", () => {
    const b = monter({ pathname: FICHE, state: marque(CLE, { list: true }) });
    const entree = b.entree();
    act(() => b.lanceur().openAt());
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toBeNull();
    expect(b.entree()).toBe(entree);
  });

  it("fermé, `select` ne fait RIEN : ouvrir, c'est `openAt` — lui seul empile ce que « fermer » défera", () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    const entree = b.entree();
    // Revenir à une liste qu'on n'a pas ouverte l'ouvrirait, par un remplacement.
    act(() => b.lanceur().select(null));
    expect(b.lanceur().open).toBe(false);
    expect(b.etat()).toBeNull();
    // Choisir un fil aussi, sans rien empiler.
    act(() => b.lanceur().select(QUESTION));
    expect(b.lanceur().open).toBe(false);
    expect(b.param()).toBeNull();
    expect(b.entree()).toBe(entree);
  });

  it("fermé, `select(null)` n'efface pas non plus l'adresse d'une AUTRE discussion", () => {
    const autre = `answers:${AUTRE_COMMUN}`;
    const b = monter(`${FICHE}?discussion=${autre}`);
    act(() => b.lanceur().select(null));
    expect(b.param()).toBe(autre);
    expect(b.lanceur().open).toBe(false);
  });

  it("ouvrir garde ce que d'AUTRES ont rangé dans l'entrée d'où l'on part", () => {
    const b = monter({ pathname: FICHE, state: { from: "/login" } });
    act(() => b.lanceur().openAt());
    expect(b.etat()).toEqual({ from: "/login", ...marque(CLE, { pushed: true }) });
  });

  it("écrit sous le nom de paramètre qu'on lui donne, et sous lui seul", () => {
    const b = monter(FICHE, { param: "fil" });
    act(() => b.lanceur().openAt());
    expect(b.param("fil")).toBe(`answers:${COMMUN}`);
    expect(b.param("discussion")).toBeNull();
    expect(b.lanceur().open).toBe(true);
  });

  it("`openAt` sur une modale déjà ouverte change de fil, sans empiler", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().openAt(QUESTION));
    expect(b.lanceur().target).toEqual(QUESTION);
    // Une seule entrée a été empilée : un « retour » suffit à retrouver la fiche fermée.
    await b.reculer();
    expect(b.chemin()).toBe(FICHE);
    expect(b.lanceur().open).toBe(false);
  });
});

describe("useSpaceLauncher — fermer", () => {
  it("ouverte d'ici : fermer DÉFAIT l'ouverture — « retour » ramène ensuite avant la fiche", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt(QUESTION));
    await act(async () => { b.lanceur().close(); });
    expect(b.lanceur().open).toBe(false);
    expect(b.chemin()).toBe(FICHE);
    expect(b.param()).toBeNull();

    // Fermer n'a rien empilé : la page d'avant la fiche est à UN « retour », pas la modale.
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("… et « suivant » la retrouve, sur son fil", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt(QUESTION));
    await act(async () => { b.lanceur().close(); });
    await b.avancer();
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(QUESTION);
  });

  it("le changement de fil garde la mémoire de l'ouverture : fermer défait toujours", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(QUESTION));
    await act(async () => { b.lanceur().close(); });
    expect(b.lanceur().open).toBe(false);
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("arrivé par un lien : fermer efface le paramètre en REMPLAÇANT l'entrée — rien à défaire derrière", async () => {
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`, undefined, ["/aac"]);
    act(() => b.lanceur().close());
    expect(b.lanceur().open).toBe(false);
    // Sans cela, recharger la page rouvrirait la modale.
    expect(b.param()).toBeNull();
    expect(b.chemin()).toBe(FICHE);
    // Remplacée, pas empilée : « retour » quitte la fiche, il ne rouvre rien.
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("depuis la liste des fils, ouverte d'ici : fermer défait l'ouverture, sans entrée morte", async () => {
    // Le cas du téléphone : ouvrir, flèche « retour aux fils », croix.
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(null));
    await act(async () => { b.lanceur().close(); });
    expect(b.lanceur().open).toBe(false);
    expect(b.chemin()).toBe(FICHE);
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("depuis la liste des fils, arrivé par un lien : fermer remplace", async () => {
    const b = monter(`${FICHE}?discussion=answers:${COMMUN}`, undefined, ["/aac"]);
    act(() => b.lanceur().select(null));
    act(() => b.lanceur().close());
    expect(b.lanceur().open).toBe(false);
    expect(b.etat()).toBeNull();
    await b.reculer();
    expect(b.chemin()).toBe("/aac");
  });

  it("n'efface JAMAIS l'adresse d'une autre discussion", () => {
    // Un fil d'un autre commun dans l'adresse : ce n'est pas à cette fiche de le retirer.
    const autre = `answers:${AUTRE_COMMUN}`;
    const fermee = monter(`${FICHE}?discussion=${autre}`);
    act(() => fermee.lanceur().close());
    expect(fermee.param()).toBe(autre);

    // Même ouverte sur sa liste : elle se ferme, l'adresse de l'autre reste.
    const surLaListe = monter({ pathname: FICHE, search: `?discussion=${autre}`, state: marque(CLE, { list: true }) });
    expect(surLaListe.lanceur().open).toBe(true);
    act(() => surLaListe.lanceur().close());
    expect(surLaListe.lanceur().open).toBe(false);
    expect(surLaListe.param()).toBe(autre);
  });

  it("une marque « empilée » approchante ne vaut pas : fermer REMPLACE, il ne recule pas", async () => {
    // Reculer sur la foi d'une marque qu'on n'a pas posée ferait quitter la fiche.
    const b = monter(
      { pathname: FICHE, search: `?discussion=answers:${COMMUN}`, state: marque(CLE, { pushed: "oui" }) },
      undefined, ["/aac"],
    );
    await act(async () => { b.lanceur().close(); });
    expect(b.chemin()).toBe(FICHE);
    expect(b.param()).toBeNull();
    expect(b.lanceur().open).toBe(false);
  });

  it("fermée, `close` ne touche à rien — surtout pas à l'historique", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    const entree = b.entree();
    await act(async () => { b.lanceur().close(); });
    expect(b.chemin()).toBe(FICHE);
    // Pas même une navigation vers la même adresse : l'entrée est restée la même.
    expect(b.entree()).toBe(entree);
  });
});

/**
 * L'adresse atteint React dans une transition : entre l'ordre et le rendu qui le reflète, le même
 * ordre peut repartir — un double toucher sur un téléphone, deux Échap. Ici les deux appels sont
 * faits dans le même `act`, donc avant tout nouveau rendu : c'est exactement cet intervalle.
 */
describe("useSpaceLauncher — un ordre répété avant que l'adresse n'arrive", () => {
  it("deux `openAt` n'empilent qu'UNE entrée", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => { b.lanceur().openAt(); b.lanceur().openAt(); });
    expect(b.lanceur().open).toBe(true);
    // Avec une entrée jumelle, ce « retour » retomberait sur elle : la modale resterait ouverte.
    await b.reculer();
    expect(b.lanceur().open).toBe(false);
    expect(b.chemin()).toBe(FICHE);
  });

  it("deux `close` ne font qu'UN « retour » — le second ferait quitter la fiche", async () => {
    const b = monter(FICHE, undefined, ["/accueil", "/aac"]);
    act(() => b.lanceur().openAt());
    await act(async () => { b.lanceur().close(); b.lanceur().close(); });
    expect(b.chemin()).toBe(FICHE);
    expect(b.lanceur().open).toBe(false);
  });

  it("l'ordre suivant est de nouveau écouté dès que l'adresse est arrivée", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    await act(async () => { b.lanceur().close(); });
    // Fermée pour de bon : un verrou resté pris aurait rendu `close` muet, et la suite passerait
    // par « déjà ouverte » — même fil à l'arrivée, mais sans rien avoir fermé ni rouvert.
    expect(b.lanceur().open).toBe(false);
    act(() => b.lanceur().openAt(QUESTION));
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(QUESTION);
    // Et c'est bien une ouverture : elle a empilé son entrée, qu'un « retour » défait.
    await b.reculer();
    expect(b.chemin()).toBe(FICHE);
    expect(b.lanceur().open).toBe(false);
  });

  it("… y compris après un « retour » du navigateur, qui ramène sur l'entrée d'où l'on avait ouvert", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    await b.reculer();
    expect(b.lanceur().open).toBe(false);
    act(() => b.lanceur().openAt());
    expect(b.lanceur().open).toBe(true);
  });
});

describe("useSpaceLauncher — l'historique du navigateur", () => {
  it("« retour » après avoir ouvert FERME la modale, sans quitter la fiche", async () => {
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    expect(b.lanceur().open).toBe(true);

    await b.reculer();
    // Ouvrir a EMPILÉ une entrée : on revient à la fiche, pas à la page d'avant.
    expect(b.chemin()).toBe(FICHE);
    expect(b.param()).toBeNull();
    expect(b.lanceur().open).toBe(false);
  });

  it("« suivant » la rouvre sur le fil qu'on avait quitté", async () => {
    const b = monter();
    act(() => b.lanceur().openAt(QUESTION));
    await b.reculer();
    await b.avancer();
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toEqual(QUESTION);
  });

  it("depuis la liste des fils aussi, « retour » ferme — et « suivant » y ramène", async () => {
    // Le cas du téléphone : la flèche ramène à la liste, puis le bouton retour du système.
    const b = monter(FICHE, undefined, ["/aac"]);
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(null));
    expect(b.lanceur().open).toBe(true);

    await b.reculer();
    expect(b.chemin()).toBe(FICHE);
    expect(b.lanceur().open).toBe(false);

    // La liste vit dans l'entrée : on la retrouve en avançant, comme on retrouverait un fil.
    await b.avancer();
    expect(b.lanceur().open).toBe(true);
    expect(b.lanceur().target).toBeNull();
  });

  it("une fois fermée par « retour », une autre navigation ne la rouvre pas", async () => {
    const b = monter();
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(null));
    await b.reculer();
    expect(b.lanceur().open).toBe(false);

    // Une ancre du sommaire de la fiche : une navigation qui n'est pas une traversée.
    await b.aller({ hash: "#budget" });
    expect(b.lanceur().open).toBe(false);
  });

  it("changer de fil REMPLACE l'entrée : un seul « retour » ramène avant l'ouverture", async () => {
    const b = monter();
    act(() => b.lanceur().openAt());
    act(() => b.lanceur().select(QUESTION));
    await b.reculer();
    expect(b.param()).toBeNull();
    expect(b.lanceur().open).toBe(false);
  });
});
