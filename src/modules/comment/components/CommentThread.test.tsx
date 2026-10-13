// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { AuthModalContext } from "@/modules/auth/context/AuthModalContext";
import type { Editor } from "@tiptap/core";
import { loadEditorSurface } from "./editor/editorStore";
import { stubSelectionGeometry } from "./editor/__tests__/jsdom";
import type { CommentNode } from "../types";
import "../i18n";

/**
 * Le parcours du fil au CLAVIER (J12).
 *
 * Ce qui est vérifié ici n'est pas une apparence mais un COMPTE : combien d'arrêts de
 * tabulation séparent l'entrée du fil du champ de saisie. Sans roving tabindex, un fil de
 * douze messages en impose une quarantaine — chaque message offrant réagir, répondre et son
 * menu. La mesure est donc le test : un seul message dans l'ordre de tabulation à la fois,
 * les flèches déplaçant ce privilège.
 *
 * Seules les FRONTIÈRES sont simulées (la requête, les mutations, la session). La règle de
 * navigation, elle, est jugée sur le vrai composant : c'est elle qui est en question.
 */

const ME = "a".repeat(24);

function node(id: string, replies: CommentNode[] = []): CommentNode {
  return {
    id, text: `message ${id}`,
    author: { id: "b".repeat(24), name: "Camille", slug: "camille", avatarUrl: null },
    createdAt: 1_700_000_000, updatedAt: null, parentId: null, path: null,
    reactions: {}, myReaction: null, mentions: [], images: [], unread: false, replies,
  };
}

const NODES = [node("c1"), node("c2"), node("c3")];
/** L'arbre servi par la requête simulée — remplaçable par test. */
let arbre: CommentNode[] = NODES;
/** L'état de la requête simulée : messages chargés, et aucune relecture en cours. */
const requete = { isSuccess: true, isFetching: false, isError: false, avecDonnees: true };

/** La session simulée : connectée par défaut, anonyme quand un test le demande. */
const session = vi.hoisted(() => ({ me: null as null | { id: string; isConnected: boolean } }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: session.me, api: null, entity: null, helper: {} }),
}));
vi.mock("../hooks/useCommentsQuery", () => ({
  useCommentsQuery: () => ({
    nodes: arbre, index: new Map(), host: null, target: { type: "news", id: "x" },
    isLoading: false, refetch: vi.fn(), ...requete,
    data: requete.avecDonnees ? { nodes: arbre } : undefined,
  }),
}));
/** Ce que le fil demande au marquage « lu » : la cible et le compteur retenu. */
const marquage = vi.hoisted(() => ({ appels: [] as Array<[unknown, readonly string[]]> }));
vi.mock("../hooks/useMarkThreadSeen", () => ({
  useMarkThreadSeen: (target: unknown, unread: readonly string[]) => { marquage.appels.push([target, unread]); },
}));
/** Les options reçues par les mutations : le fil y branche le rappel d'un envoi refusé. */
const mutationsRecues = vi.hoisted(() => ({
  options: null as null | { onSendFailed?: (draft: { text: string; mentions: unknown[]; parentId: string | null }) => void },
  /** Le signalement, STABLE d'un rendu à l'autre : on y lit ce que le fil a demandé, et quand fermer. */
  signaler: vi.fn(),
}));
vi.mock("../hooks/useCommentMutations", () => ({
  useCommentMutations: (options: typeof mutationsRecues.options) => {
    mutationsRecues.options = options;
    const stub = { mutate: vi.fn(), isPending: false };
    return {
      add: stub, reply: stub, edit: stub, remove: stub, react: stub,
      report: { mutate: mutationsRecues.signaler, isPending: false },
    };
  },
}));

const { CommentThread } = await import("./CommentThread");

function mount(props: Parameters<typeof CommentThread>[0] = {}) {
  // Un connecté voit le composer (revue du 29/09 : il en était privé sans `userContext`), et sa
  // recherche de mentions passe par React Query.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, createElement(LocalizationProvider, null, children));
  const { container, rerender } = render(createElement(CommentThread, props), { wrapper });
  const rows = [...container.querySelectorAll<HTMLElement>("[data-comment-row]")];
  return { container, rows, relire: () => rerender(createElement(CommentThread, props)) };
}

/** Les éléments réellement atteignables par TABULATION dans le fil. */
/**
 * Les arrêts de tabulation DES MESSAGES. Le champ du composer en est un à lui, hors de la liste :
 * l'éditeur porte son `tabindex="0"` en attribut, là où un `<textarea>` l'avait de naissance.
 */
function tabbable(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[tabindex]")]
    .filter(el => el.getAttribute("tabindex") === "0" && !el.hasAttribute("data-comment-field"));
}

// Le composer du fil écrit dans un éditeur chargé à part : une fois pour le fichier, chaque fil
// monté ensuite le trouve tout de suite.
beforeAll(async () => {
  stubSelectionGeometry();
  await loadEditorSurface();
});

/** Le champ du composer : l'élément éditable, et l'éditeur qu'il porte. */
type Champ = HTMLElement & { editor: Editor };
const champDe = (container: HTMLElement) => container.querySelector("[data-comment-field]") as Champ | null;
/** L'éditeur donne le focus à l'image suivante, pas dans l'instant. */
const image = () => act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(null))); });

beforeEach(() => {
  vi.clearAllMocks();
  arbre = NODES;
  marquage.appels.length = 0;
  requete.isSuccess = true;
  session.me = { id: ME, isConnected: true };
  requete.isError = false;
  requete.avecDonnees = true;
  requete.isFetching = false;
});

describe("CommentThread — navigation clavier", () => {
  it("n'expose qu'UN message à la tabulation", () => {
    const { rows } = mount();
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("les contrôles des messages inactifs sortent de l'ordre de tabulation", () => {
    const { container, rows } = mount();
    // Chaque ligne porte une barre d'actions ; seules celles du message actif comptent.
    const actionsOfInactive = rows[1]!.querySelectorAll("[data-comment-actions] button");
    expect(actionsOfInactive.length).toBeGreaterThan(0);
    for (const button of actionsOfInactive) {
      expect(button.getAttribute("tabindex")).toBe("-1");
    }
    // Le compte global : le message actif, plus SES seuls contrôles.
    const stops = tabbable(container);
    expect(stops.filter(el => el.hasAttribute("data-comment-row"))).toHaveLength(1);
    expect(stops.every(el => el === rows[0] || rows[0]!.contains(el))).toBe(true);
  });

  it("la flèche bas déplace le privilège ET le focus", () => {
    const { rows } = mount();
    rows[0]!.focus();
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(rows.map(r => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(document.activeElement).toBe(rows[1]);
  });

  it("la flèche fait SUIVRE la vue, au plus près — le focus partait hors de vue (revue du 29/09)", () => {
    const defiler = vi.fn();
    Element.prototype.scrollIntoView = defiler;
    try {
      const { rows } = mount();
      rows[0]!.focus();
      fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
      expect(defiler).toHaveBeenCalledWith({ block: "nearest" });
      expect(defiler.mock.contexts[defiler.mock.contexts.length - 1]).toBe(rows[1]);
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("Fin va au dernier message, Début au premier", () => {
    const { rows } = mount();
    rows[0]!.focus();
    fireEvent.keyDown(rows[0]!, { key: "End" });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2]!, { key: "Home" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("les flèches ne sortent pas du fil par les bords", () => {
    const { rows } = mount();
    rows[0]!.focus();
    fireEvent.keyDown(rows[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0]!, { key: "End" });
    fireEvent.keyDown(rows[2]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[2]);
  });

  it("une flèche tapée DANS un contrôle garde son sens propre", () => {
    const { rows } = mount();
    const button = rows[0]!.querySelector<HTMLElement>("[data-comment-actions] button");
    expect(button).toBeTruthy();
    rows[0]!.focus();
    // L'événement remonte jusqu'au conteneur du fil : c'est la CIBLE qui doit le désamorcer,
    // sans quoi la flèche haut deviendrait inutilisable dans le champ d'édition.
    fireEvent.keyDown(button!, { key: "ArrowDown", bubbles: true });
    expect(rows.map(r => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("le focus reçu par la souris déplace aussi le privilège", () => {
    const { rows } = mount();
    fireEvent.focus(rows[2]!);
    expect(rows.map(r => r.getAttribute("tabindex"))).toEqual(["-1", "-1", "0"]);
  });
});

describe("CommentThread — repli d'office", () => {
  const reponses = (n: number, over: Partial<CommentNode> = {}) =>
    Array.from({ length: n }, (_, i) => ({ ...node(`x${i}`), ...over }));
  const repli = (container: HTMLElement) =>
    container.querySelector("[data-comment-collapse]")?.getAttribute("aria-expanded");

  it("replie une branche de plus de cinq réponses, toutes lues", () => {
    arbre = [node("r", reponses(6))];
    const { container, rows } = mount();
    expect(rows).toHaveLength(1);
    expect(repli(container)).toBe("false");
  });

  it("laisse ouverte une branche de cinq réponses ou moins", () => {
    arbre = [node("r", reponses(5))];
    const { container, rows } = mount();
    expect(rows).toHaveLength(6);
    expect(repli(container)).toBe("true");
  });

  it("ne replie jamais une branche qui porte du nouveau", () => {
    arbre = [node("r", [...reponses(5), { ...node("neuf"), unread: true }])];
    const { rows } = mount();
    expect(rows).toHaveLength(7);
  });

  /**
   * Revue du 29/09 : le marquage « lu » part dès l'affichage, et la relecture suivante (réponse
   * postée, retour sur l'onglet) rendait tout « lu » — la branche se refermait sous les yeux, sur
   * la réponse qu'on venait d'écrire, et le repère « nouveau » s'éteignait.
   */
  it("ne referme pas à la relecture une branche ouverte pour du nouveau, ni n'en éteint le repère", () => {
    arbre = [node("r", [...reponses(5), { ...node("neuf"), unread: true }])];
    const { container, relire } = mount();
    arbre = [node("r", [...reponses(5), node("neuf")])]; // le serveur dit désormais TOUT lu
    relire();
    expect(container.querySelectorAll("[data-comment-row]")).toHaveLength(7);
    expect(repli(container)).toBe("true");
    expect(container.querySelector('[data-comment-row][data-unread="true"]')).not.toBeNull();
  });

  /**
   * Le défaut relevé le 28/09 : le repli d'office se fondait sur la PROFONDEUR, et son propre
   * message n'étant jamais « non lu », rien ne retenait la branche — répondre à un message de
   * niveau 2 masquait la réponse à l'instant où elle était postée.
   */
  /** Arbitré le 28/09 : une mention déjà vue ne retient plus la branche, comme son fond disparaît. */
  it("replie aussi une branche dont la mention est déjà lue", () => {
    arbre = [node("r", reponses(6, { mentions: [{ id: ME, name: "Moi", slug: "moi" }] }))];
    const { container, rows } = mount();
    expect(rows).toHaveLength(1);
    expect(repli(container)).toBe("false");
  });

  it("ne replie plus rien sur la seule profondeur", () => {
    arbre = [node("r", [node("a", [node("b", [node("c")])])])];
    const { rows } = mount();
    expect(rows.map(r => r.getAttribute("data-comment-id"))).toEqual(["r", "a", "b", "c"]);
  });

  /**
   * Répondre ouvre toute la LIGNÉE du message visé, pas son seul fil de réponses. Ici, un envoi
   * refusé rétablit le « réponse à » sur un message rangé derrière un repli d'office : renvoyer
   * doit le ramener en vue, sans quoi la réponse partirait se ranger hors de vue.
   */
  it("répondre à un message replié plus haut déplie toute sa lignée", () => {
    arbre = [node("r", reponses(6))];
    const { container } = mount();
    expect(container.querySelectorAll("[data-comment-row]")).toHaveLength(1);
    act(() => { mutationsRecues.options?.onSendFailed?.({ text: "ma réponse", mentions: [], parentId: "x3" }); });
    act(() => { fireEvent.keyDown(champDe(container)!, { key: "Enter" }); });
    expect(container.querySelector('[data-comment-id="x3"]')).not.toBeNull();
  });
});

/**
 * Un fil AFFICHÉ est un fil lu, où qu'il soit monté — et seulement ce qui a été affiché.
 *
 * Le défaut vu au navigateur le 28/09 : le marquage partait à l'ouverture, avant le chargement ;
 * le serveur marquait les messages lus AVANT de les renvoyer, et aucun repère n'apparaissait.
 */
describe("CommentThread — un fil affiché se marque lu", () => {
  const dernier = () => marquage.appels[marquage.appels.length - 1];

  it("demande le marquage des non-lus AFFICHÉS, par identifiant, une fois les messages chargés", () => {
    arbre = [node("r", [{ ...node("n1"), unread: true }, { ...node("n2"), unread: true }])];
    mount();
    expect(dernier()).toEqual([{ type: "news", id: "x" }, ["n1", "n2"]]);
  });

  it("ne demande rien tant qu'une lecture des messages est en cours", () => {
    requete.isFetching = true;
    arbre = [node("r", [{ ...node("n1"), unread: true }])];
    mount();
    expect(dernier()?.[0]).toBeNull();
  });

  it("ne demande rien avant le premier chargement", () => {
    requete.isSuccess = false;
    arbre = [node("r", [{ ...node("n1"), unread: true }])];
    mount();
    expect(dernier()?.[0]).toBeNull();
  });

  it("sans aucun non-lu, aucun identifiant n'est transmis — le hook n'écrit alors rien", () => {
    mount();
    expect(dernier()?.[1]).toEqual([]);
  });
});

describe("CommentThread — envoi refusé (revue du 29/09)", () => {
  it("remet le texte refusé dans le champ, curseur dedans — il était perdu", async () => {
    const { container } = mount();
    act(() => { mutationsRecues.options?.onSendFailed?.({ text: "texte à renvoyer", mentions: [], parentId: null }); });
    await image();
    const champ = champDe(container)!;
    expect(champ.editor.getText()).toBe("texte à renvoyer");
    expect(document.activeElement).toBe(champ);
  });

  it("le texte refusé revient tel que le fil l'aurait rendu, mentions comprises", () => {
    const { container } = mount();
    const camille = { id: "e".repeat(24), name: "Camille", slug: "camille" };
    act(() => { mutationsRecues.options?.onSendFailed?.({ text: "merci **beaucoup** @camille", mentions: [camille], parentId: null }); });
    const champ = champDe(container)!;
    expect(champ.querySelector("strong")?.textContent).toBe("beaucoup");
    expect(champ.querySelector("[data-type='mention']")?.getAttribute("data-slug")).toBe("camille");
  });

  it("rétablit le « réponse à » d'une réponse refusée", () => {
    const { container } = mount();
    act(() => { mutationsRecues.options?.onSendFailed?.({ text: "ma réponse", mentions: [], parentId: "c2" }); });
    const champ = champDe(container)!;
    expect(champ.editor.getText()).toBe("ma réponse");
    // Le champ se nomme d'après ce qu'on y fait : on y répond de nouveau à Camille.
    expect(champ.getAttribute("aria-label")).toContain("Camille");
  });
});

describe("CommentThread — relecture en échec (revue du 29/09)", () => {
  it("garde les messages en cache, avec un avertissement discret, quand une RELECTURE échoue", () => {
    requete.isError = true;
    const { container, rows } = mount();
    expect(rows).toHaveLength(3);
    expect(container.querySelector("[data-thread-stale]")).not.toBeNull();
  });

  it("n'affiche l'écran d'erreur que s'il n'y a rien à montrer", () => {
    requete.isError = true;
    requete.avecDonnees = false;
    const { container, rows } = mount();
    expect(rows).toHaveLength(0);
    expect(container.querySelector("[data-thread-stale]")).toBeNull();
    expect(container.textContent).toContain("La discussion n'a pas pu être chargée");
  });
});

describe("CommentThread — lien vers un message (revue du 29/09)", () => {
  const ouvrirLeLien = (id: string) => { window.history.replaceState(null, "", `#m-${id}`); };
  const fermerLeLien = () => { window.history.replaceState(null, "", window.location.pathname); };

  // Le fragment n'accepte qu'un identifiant Mongo (`parseMessageFragment`) : des ids réalistes.
  const hex = (prefixe: string, i: number) => `${prefixe.repeat(23)}${i}`;

  it("amène au message désigné par le fragment `#m-…` : le lien copié n'amenait qu'au fil", () => {
    arbre = [node(hex("c", 1)), node(hex("c", 2)), node(hex("c", 3))];
    ouvrirLeLien(hex("c", 3));
    try {
      const { container } = mount();
      const cible = container.querySelector(`[data-comment-id="${hex("c", 3)}"]`);
      expect(document.activeElement).toBe(cible);
      expect(cible?.getAttribute("data-highlighted")).toBe("true");
    } finally { fermerLeLien(); }
  });

  it("déplie la branche repliée d'office qui cache le message du lien", () => {
    const reponses = Array.from({ length: 6 }, (_, i) => node(hex("e", i)));
    arbre = [node(hex("d", 0), reponses)];
    ouvrirLeLien(hex("e", 4));
    try {
      const { container } = mount();
      expect(container.querySelector(`[data-comment-id="${hex("e", 4)}"]`)).not.toBeNull();
      expect(document.activeElement?.getAttribute("data-comment-id")).toBe(hex("e", 4));
    } finally { fermerLeLien(); }
  });
});

describe("CommentThread — visiteur anonyme (revue du 29/09)", () => {
  it("l'invite à se connecter à la place du composer — rien ne l'invitait à répondre", () => {
    session.me = null;
    const { container } = mount();
    expect(champDe(container)).toBeNull();
    expect(container.querySelector("[data-comment-field-loading]")).toBeNull();
    const invitation = container.querySelector("[data-login-to-participate]");
    expect(invitation?.textContent).toContain("Connectez-vous pour participer");
  });

  it("sur un fil vide, ne l'invite qu'UNE fois — l'état vide la répétait", () => {
    session.me = null;
    arbre = [];
    const { container } = mount();
    expect(container.textContent!.split("Connectez-vous pour participer")).toHaveLength(2);
  });

  it("ne l'invite pas à participer à un fil fermé aux contributions", () => {
    session.me = null;
    const { container } = mount({ enabled: false });
    expect(container.querySelector("[data-login-to-participate]")).toBeNull();
  });

  it("un connecté, lui, est invité à lancer la discussion", () => {
    arbre = [];
    const { container } = mount();
    expect(container.textContent).toContain("Lancez la discussion.");
    expect(container.querySelector("[data-login-to-participate]")).toBeNull();
  });

  it("ouvre la connexion sur place quand la modale de connexion est disponible", async () => {
    session.me = null;
    const openLogin = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      createElement(QueryClientProvider, { client },
        createElement(AuthModalContext.Provider, { value: { openLogin } as never },
          createElement(LocalizationProvider, null, createElement(CommentThread, {})))),
    );
    const bouton = container.querySelector<HTMLButtonElement>("[data-login-to-participate] button");
    expect(bouton).not.toBeNull();
    fireEvent.click(bouton!);
    expect(openLogin).toHaveBeenCalled();
  });
});

/**
 * Le signalement se ferme au SUCCÈS seulement (revue du 29/09) : il se fermait — et se vidait —
 * avant la réponse du serveur, si bien qu'un refus passait inaperçu et qu'il fallait tout
 * ressaisir. Ici, le câblage entre le fil et la mutation.
 */
describe("CommentThread — signalement", () => {
  // Le menu et le sélecteur de Radix s'appuient sur des API de pointeur que jsdom n'a pas.
  const manquantes = ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"] as const;
  beforeAll(() => {
    for (const nom of manquantes) (Element.prototype as unknown as Record<string, unknown>)[nom] ??= () => false;
  });
  afterAll(() => {
    for (const nom of manquantes) delete (Element.prototype as unknown as Record<string, unknown>)[nom];
  });

  it("reste ouvert après l'envoi, et ne se ferme qu'au succès du signalement", async () => {
    const { container } = mount();
    const user = userEvent.setup();
    const ligne = container.querySelector<HTMLElement>('[data-comment-id="c1"]')!;
    await user.click(within(ligne).getByRole("button", { name: "Plus d'actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Signaler" }));
    await user.click(await screen.findByRole("combobox"));
    await user.click((await screen.findAllByRole("option"))[0]!);
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    expect(mutationsRecues.signaler).toHaveBeenCalledTimes(1);
    const [demande, rappels] = mutationsRecues.signaler.mock.calls[0]! as [{ commentId: string }, { onSuccess: () => void }];
    expect(demande.commentId).toBe("c1");
    // Envoyé, pas encore accepté : le dialogue est toujours là.
    expect(screen.getByRole("dialog")).toBeTruthy();

    act(() => rappels.onSuccess());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * « Modifier » ouvre le champ d'édition DANS la ligne — et le curseur doit y aller. Le focus est
   * posé à la fermeture du menu (tant qu'il s'anime, son piège ramène à lui tout focus posé
   * au-dehors) : c'est ce câblage-là qu'on tient, avec le vrai menu et le vrai éditeur.
   */
  it("« Modifier » ouvre le champ d'édition du message, relu tel que le fil le rend, curseur dedans", async () => {
    arbre = [{ ...node("c1"), author: { id: ME, name: "Moi", slug: "moi", avatarUrl: null }, text: "du **gras** à corriger" }, node("c2")];
    const { container } = mount();
    const user = userEvent.setup();
    const ligne = container.querySelector<HTMLElement>('[data-comment-id="c1"]')!;
    await user.click(within(ligne).getByRole("button", { name: "Plus d'actions" }));
    // L'éditeur se donne lui-même le focus à l'image suivante (`autoFocus`). On retient cette image :
    // seul le focus posé À LA FERMETURE DU MENU peut alors l'y mettre — c'est lui qu'on juge.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    try {
      await user.click(await screen.findByRole("menuitem", { name: "Modifier" }));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

      const champs = container.querySelectorAll<Champ>("[data-comment-field]");
      // Deux champs : celui de l'édition, dans la ligne, et celui du bas du fil.
      expect(champs).toHaveLength(2);
      const edition = ligne.querySelector<Champ>("[data-comment-field]")!;
      expect(edition.querySelector("strong")?.textContent).toBe("gras");
      expect(edition.getAttribute("aria-label")).toBe("Modifier le message…");
      expect(document.activeElement).toBe(edition);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
