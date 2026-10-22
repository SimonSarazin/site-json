// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CommentRow, type MessageRow } from "./CommentRow";
import type { CommentNode } from "../types";
import type { CommentPermissions } from "../permissions";
import "../i18n";

/**
 * Les dix états de la grammaire visuelle.
 *
 * Dix, et non onze : l'état « modifié » a été RETIRÉ après mesure — le backend ne trace pas
 * l'édition d'un message, et le champ qu'on prenait pour un marqueur d'édition marque en
 * réalité une réaction (B10).
 *
 * Ils sont vérifiés sur les attributs `data-*` de la ligne, et c'est délibéré : ce sont eux
 * qui pilotent le style (classes `data-[…]` et `styles.css`), donc tester l'attribut teste la
 * cause, pas une couleur calculée qu'aucun test ne saurait juger. Le rendu en clair/sombre et
 * sur plusieurs thèmes se vérifie au navigateur ; ce que cette suite garantit, c'est qu'aucun
 * état ne disparaît en silence d'un refactor.
 */

const ME = "a".repeat(24);
const OTHER = "b".repeat(24);

const ALL_ALLOWED: CommentPermissions = {
  canComment: true, canReply: true, canReact: true, canReport: true, canModerate: false,
};

function node(overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id: "c".repeat(24),
    text: "un message",
    author: { id: OTHER, name: "Camille", slug: "camille", avatarUrl: null },
    createdAt: 1_700_000_000,
    updatedAt: null,
    parentId: null,
    path: null,
    reactions: {},
    myReaction: null,
    mentions: [],
    images: [],
    unread: false,
    replies: [],
    ...overrides,
  };
}

function row(overrides: Partial<MessageRow> = {}, nodeOverrides: Partial<CommentNode> = {}): MessageRow {
  return {
    kind: "message",
    key: "k",
    node: node(nodeOverrides),
    grouped: false,
    depth: 0,
    realDepth: 0,
    contextParent: null,
    dayShift: false,
    ...overrides,
  };
}

function mount(props: Partial<Parameters<typeof CommentRow>[0]> = {}) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(LocalizationProvider, null, children);
  const { container } = render(
    createElement(CommentRow, { row: row(), meId: ME, permissions: ALL_ALLOWED, ...props }),
    { wrapper },
  );
  const article = container.querySelector("[data-comment-row]");
  if (!article) throw new Error("ligne non rendue");
  return article as HTMLElement;
}

describe("CommentRow — les 11 états", () => {
  it("1. par défaut : avatar, nom et heure en tête de bloc", () => {
    const el = mount();
    expect(el.dataset.grouped).toBe("false");
    expect(screen.getByText("Camille")).toBeTruthy();
    // L'en-tête porte une heure machine-lisible, indispensable au tri et aux lecteurs d'écran.
    expect(el.querySelector("time[datetime]")).toBeTruthy();
  });

  it("2. groupé : ni avatar ni en-tête, l'heure passe dans la gouttière", () => {
    const el = mount({ row: row({ grouped: true }) });
    expect(el.dataset.grouped).toBe("true");
    expect(screen.queryByText("Camille")).toBeNull();
    expect(el.querySelector(".comment-groupline-time")).toBeTruthy();
  });

  it("3. le mien : modifiable et supprimable, non signalable", () => {
    const el = mount({ row: row({}, { author: { id: ME, name: "Moi", slug: null, avatarUrl: null } }) });
    expect(el.dataset.own).toBe("true");
    // On ne se signale pas soi-même : le bouton ne doit pas exister.
    expect(screen.queryByLabelText(/signaler/i)).toBeNull();
  });

  it("4. jamais de marque « modifié » : le backend ne trace pas l'édition (B10)", () => {
    // `updated` bouge quand on RÉAGIT, pas quand on modifie : la marque se posait donc sur des
    // messages jamais touchés. Mesuré, puis retiré — mieux vaut rien qu'une information fausse.
    const el = mount({ row: row({}, { updatedAt: 1_700_000_500 }) });
    expect(el.dataset.edited).toBeUndefined();
    expect(el.textContent).not.toContain("modifié");
  });

  it("5. non lu", () => {
    const el = mount({ row: row({}, { unread: true }) });
    expect(el.dataset.unread).toBe("true");
  });

  it("6. me mentionne — distinct du simple non-lu", () => {
    const el = mount({
      row: row({}, { mentions: [{ id: ME, name: "Moi", slug: "moi" }] }),
    });
    expect(el.dataset.mentioned).toBe("true");
    expect(el.dataset.unread).toBe("false");
  });

  it("7. avec réactions : une pastille par réaction, la mienne marquée", () => {
    const el = mount({ row: row({}, { reactions: { love: 3, like: 1 }, myReaction: "love" }) });
    const pills = el.querySelectorAll("[data-reaction]");
    expect(pills).toHaveLength(2);
    expect(el.querySelector('[data-reaction="love"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelector('[data-reaction="like"]')?.getAttribute("aria-pressed")).toBe("false");
  });

  it("8. en cours d'envoi : estompé, et sans aucune action", () => {
    const el = mount({ row: row({}, { pending: true }) });
    expect(el.dataset.pending).toBe("true");
    // Agir sur un message qui n'existe pas encore côté serveur produirait une erreur.
    expect(el.querySelector("[data-comment-actions]")).toBeNull();
  });

  it("9. échoué : l'état est porté et l'échec est ÉCRIT, pas seulement coloré", () => {
    const el = mount({ row: row({}, { failed: true }) });
    expect(el.dataset.failed).toBe("true");
    expect(el.textContent).toContain("Non envoyé");
  });

  it("10. cité : au-delà du retrait maximal, le parent est rappelé au lieu d'indenter", () => {
    const el = mount({
      row: row({
        depth: 2,
        realDepth: 4,
        contextParent: { id: "d".repeat(24), author: "Dominique", excerpt: "le message parent" },
      }),
    });
    // Le retrait est BORNÉ : la profondeur réelle continue, le retrait visuel non.
    expect(el.dataset.depth).toBe("2");
    expect(el.dataset.realDepth).toBe("4");
    expect(el.querySelector("[data-comment-context]")?.textContent).toContain("Dominique");
  });

  it("11. modéré : le message d'autrui devient supprimable, sans devenir modifiable", () => {
    const el = mount({ permissions: { ...ALL_ALLOWED, canModerate: true } });
    expect(el.dataset.own).toBe("false");
    expect(screen.getByLabelText(/plus d'actions/i)).toBeTruthy();
  });
});

describe("CommentRow — repli d'une branche", () => {
  it("n'affiche le repli que s'il y a des réponses", () => {
    const sans = mount();
    expect(sans.querySelector("[data-comment-collapse]")).toBeNull();

    const avec = mount({ replyCount: 3, onToggleCollapse: () => {} });
    expect(avec.querySelector("[data-comment-collapse]")).toBeTruthy();
  });

  it("annonce son état à l'assistance technique et compte la branche entière", () => {
    const el = mount({ replyCount: 3, collapsed: true, onToggleCollapse: () => {} });
    const button = el.querySelector("[data-comment-collapse]");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    // Le compte porte sur toute la branche, réponses de réponses comprises.
    expect(button?.textContent).toContain("3");
  });

  it("bascule sur demande", () => {
    const onToggleCollapse = vi.fn();
    const el = mount({ replyCount: 2, onToggleCollapse });
    fireEvent.click(el.querySelector("[data-comment-collapse]")!);
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });
});

describe("CommentRow — la ligne de service (B, 28/09)", () => {
  const reponse = (id: string, nom: string, createdAt: number) =>
    node({ id, createdAt, author: { id: `${id}-auteur`, name: nom, slug: null, avatarUrl: null } });

  it("une branche ouverte prolonge son trait jusqu'à ses réponses", () => {
    const ouverte = mount({ replyCount: 2, onToggleCollapse: () => {} });
    expect(ouverte.hasAttribute("data-open")).toBe(true);

    const fermee = mount({ replyCount: 2, collapsed: true, onToggleCollapse: () => {} });
    expect(fermee.hasAttribute("data-open")).toBe(false);

    expect(mount().hasAttribute("data-open")).toBe(false);
  });

  it("repliée, elle dit QUI a répondu et QUAND — ouverte, seulement combien", () => {
    const replies = [reponse("r1", "Alice", 1_700_000_100), reponse("r2", "Bob", 1_700_000_900)];
    const fermee = mount({
      row: row({}, { replies }), replyCount: 2, collapsed: true, onToggleCollapse: () => {},
    });
    const bouton = fermee.querySelector("[data-comment-collapse]")!;
    expect(bouton.textContent).toContain("2 réponses");
    expect(bouton.textContent).toContain("dernière");
    // Un avatar par répondant distinct — ni plus, ni moins.
    expect(bouton.querySelectorAll("[data-slot='avatar']")).toHaveLength(2);

    const ouverte = mount({ row: row({}, { replies }), replyCount: 2, onToggleCollapse: () => {} });
    const b2 = ouverte.querySelector("[data-comment-collapse]")!;
    expect(b2.textContent).toContain("2 réponses");
    expect(b2.textContent).not.toContain("dernière");
  });

  /**
   * Une seule instance d'actions, placée par le CSS : flottante à la souris, dans la ligne au
   * doigt. Deux instances masquées tour à tour feraient deux « Répondre » pour un lecteur
   * d'écran, et deux déclencheurs de menu.
   */
  it("n'a qu'UNE barre d'actions, et elle vit dans la ligne de service", () => {
    const el = mount();
    expect(el.querySelectorAll("[data-comment-actions]")).toHaveLength(1);
    expect(el.querySelector("[data-comment-service] [data-comment-actions]")).toBeTruthy();
  });

  it("« Répondre » porte son libellé écrit, que le CSS montre au doigt", () => {
    const el = mount();
    const repondre = el.querySelector("[data-action='reply']")!;
    expect(repondre.getAttribute("aria-label")).toBe("Répondre");
    expect(repondre.querySelector(".comment-action-label")?.textContent).toBe("Répondre");
  });
});

describe("CommentRow — accessibilité", () => {
  it("la barre d'actions reste dans l'ordre de tabulation (opacité, jamais `hidden`)", () => {
    const el = mount();
    const actions = el.querySelector("[data-comment-actions]");
    expect(actions).toBeTruthy();
    // `hidden` ou `display:none` la sortirait du parcours clavier : c'est le défaut que
    // `styles.css` évite en jouant sur l'opacité et `focus-within`.
    expect(actions?.hasAttribute("hidden")).toBe(false);
    expect(actions?.classList.contains("comment-actions")).toBe(true);
  });

  it("le retrait passe par une variable CSS, donc reste borné par le style", () => {
    const el = mount({ row: row({ depth: 2, realDepth: 2 }) });
    expect(el.getAttribute("style")).toContain("--comment-depth: 2");
  });

  it("chaque message est ancrable par un identifiant stable", () => {
    const el = mount();
    expect(el.id).toBe(`m-${"c".repeat(24)}`);
  });
});

describe("la marque d'état et le non-lu (arbitrés le 28/09)", () => {
  it("pose une marque DERRIÈRE le contenu, masquée aux lecteurs d'écran", () => {
    const el = mount();
    const marque = el.querySelector("[data-comment-mark]");
    expect(marque).toBeTruthy();
    expect(marque?.getAttribute("aria-hidden")).toBe("true");
    expect(el.firstElementChild).toBe(marque);
  });

  it("ne peint plus AUCUN fond d'état sur la ligne : il partait du bord du fil et repeignait l'arbre", () => {
    const el = mount({ row: row({}, { unread: true, failed: true, mentions: [{ id: ME, name: "Moi", slug: "moi" }] }) });
    const fonds = el.className.split(/\s+/).filter(c => /(^|:)bg-|shadow-\[/.test(c));
    expect(fonds).toEqual([]);
  });

  it("le non-lu se lit à l'heure : « nouveau » dans l'en-tête", () => {
    const el = mount({ row: row({}, { unread: true }) });
    expect(el.querySelector("header [data-comment-new]")?.textContent).toBe("nouveau");
  });

  it("un message lu ne porte aucun « nouveau »", () => {
    expect(mount().querySelector("[data-comment-new]")).toBeNull();
  });

  it("une ligne groupée, sans en-tête, porte son « nouveau » dans la gouttière", () => {
    const el = mount({ row: row({ grouped: true }, { unread: true }) });
    expect(el.querySelector("header")).toBeNull();
    // Le mot reste dans le DOM : visuellement réduit à un point, il est lu par les lecteurs d'écran.
    expect(el.querySelector("[data-comment-new]")?.textContent).toBe("nouveau");
  });

  it("un nom trop long pour l'en-tête reste lisible en entier au survol", () => {
    const long = "Association des parents d'élèves de l'école primaire du centre-ville";
    const el = mount({ row: row({}, { author: { id: OTHER, name: long, slug: "apecv", avatarUrl: null } }) });
    expect(el.querySelector("header span")?.getAttribute("title")).toBe(long);
  });

  it("MON @mention est marqué pour la pastille, celui d'autrui non", () => {
    const el = mount({ row: row({}, {
      text: "@moi et @camille",
      mentions: [{ id: ME, name: "Moi", slug: "moi" }, { id: OTHER, name: "Camille", slug: "camille" }],
    }) });
    expect(el.querySelector('a[href="/profil/moi"]')?.hasAttribute("data-mention-me")).toBe(true);
    expect(el.querySelector('a[href="/profil/camille"]')?.hasAttribute("data-mention-me")).toBe(false);
  });
});

describe("CommentRow — nom accessible (revue du 29/09)", () => {
  /** Le nom tel que le lecteur d'écran le compose : les éléments désignés, dans l'ordre. */
  const nomAccessible = (el: HTMLElement) =>
    (el.getAttribute("aria-labelledby") ?? "").split(" ")
      .map(id => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ");

  it("annonce l'auteur, l'heure ET le texte — l'`aria-label` taisait ce qui était écrit", () => {
    const el = mount({ row: row({}, { text: "Rendez-vous jeudi à la Fabrique" }) });
    expect(el.hasAttribute("aria-label")).toBe(false);
    const nom = nomAccessible(el);
    expect(nom).toMatch(/^Message de /);
    expect(nom).toContain("Rendez-vous jeudi à la Fabrique");
  });
});

