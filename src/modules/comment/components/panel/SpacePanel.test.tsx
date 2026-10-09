// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cocolightApiClient, { type EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { COMMENT_QUERY_KEYS } from "../../constants/queryKeys";
import type { CommentTarget, SpaceRef } from "../../types";
import "../../i18n";

/**
 * L'espace de discussion d'un commun : ses fils · les messages du fil choisi.
 *
 * L'appel au serveur est la frontière (comme le flux temps réel, absent ici) ; le panneau, sa
 * requête, la lecture de la réponse et la colonne des fils sont les VRAIS. Le fil lui-même a ses
 * propres tests : on n'observe que ce que le panneau lui PASSE, et s'il le monte.
 *
 * Ce que cette suite garantit, et qui ne se voit pas à la lecture :
 *   - un fil n'est monté que si le serveur l'a listé pour CE lecteur — une discussion réservée
 *     désignée par l'adresse n'affiche rien ;
 *   - le panneau ne ferme jamais rien : il change de fil, ou revient à la liste.
 */

vi.mock("../../hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));

let montages = 0;
vi.mock("../CommentThread", () => ({
  CommentThread: ({ target, scopeEntity }: { target?: CommentTarget | null; scopeEntity?: { id?: string } | null }) => {
    // Un numéro par MONTAGE : c'est ce qui prouve qu'un fil est remonté, et non réemployé.
    const [montage] = useState(() => ++montages);
    return (
      <div
        data-comment-thread
        data-montage={montage}
        data-target={target ? `${target.type}:${target.id}${target.path ? `:${target.path}` : ""}` : ""}
        data-scope={scopeEntity?.id ?? ""}
      />
    );
  },
}));

const { SpacePanel } = await import("./SpacePanel");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const ETAPE = "65c3000000000000000000e1";
const ETAPE_2 = "65c3000000000000000000e2";
const ESPACE: SpaceRef = { type: "answers", id: COMMUN };

const question = (etape: string, champ: string) => `${APPEL}.${etape}.${COMMUN}.${champ}.question_${champ}.comment`;
const CHEMINS = {
  admins: `${APPEL}.moreDiscussions_admins.${COMMUN}.discu_3.privateComment`,
  annonces: `${APPEL}.moreDiscussions_annonces.${COMMUN}.discu_2.commentPublic`,
  comite: `${APPEL}.moreDiscussions_comite.${COMMUN}.discu_1.comment`,
  titre: question(ETAPE, "titre"),
  budget: question(ETAPE, "budget"),
  // Une question de l'appel dont le libellé est vide : le serveur la liste, sans titre.
  sansLibelle: question(ETAPE, "muette"),
  avis: question(ETAPE_2, "avis"),
  depense: `${question(ETAPE, "depense")}.financement.depensekey.aapStep1-depense.depenseindex.1`,
  depenseSansNom: `${question(ETAPE, "depense")}.financement.depensekey.aapStep1-depense.depenseindex.4`,
  autre: `${APPEL}.${ETAPE}.${COMMUN}.libre.note`,
  // Une discussion réservée que le serveur ne liste PAS à ce lecteur.
  reservee: `${APPEL}.moreDiscussions_jury.${COMMUN}.discu_9.privateComment`,
} as const;

const GENERAL: CommentTarget = { type: "answers", id: COMMUN, path: null };
const cible = (chemin: string): CommentTarget => ({ type: "forms", id: APPEL, path: chemin });
const cle = (chemin: string) => `forms:${APPEL}:${chemin}`;
const CLE_GENERALE = `answers:${COMMUN}`;

/** Une ligne de l'appel, telle que le serveur la rend. */
function ligne(chemin: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: cle(chemin), contextType: "forms", contextId: APPEL, path: chemin, title: null, carrier: null,
    total: 0, unread: 0, last: null, mine: false, virtual: false, kind: "question", group: null, audience: null, ...over,
  };
}

/**
 * Dans l'ordre du serveur : général, discussions (par titre), questions (ordre de l'appel), dépenses.
 * La dernière ligne porte une nature que cet écran ne connaît pas — celle d'un serveur plus récent.
 */
const FILS = [
  { key: CLE_GENERALE, contextType: "answers", contextId: COMMUN, path: null, title: null, carrier: null, total: 3, unread: 1, last: 1_758_000_000, mine: false, virtual: false, kind: "general", group: null, audience: null },
  ligne(CHEMINS.admins, { title: "Admins seulement", total: 1, last: 1_757_000_000, kind: "discussion", audience: "private" }),
  ligne(CHEMINS.annonces, { title: "Annonces", virtual: true, kind: "discussion", audience: "authorAll" }),
  ligne(CHEMINS.comite, { title: "Comité de sélection", total: 2, last: 1_757_000_100, kind: "discussion", audience: "authorAdmin" }),
  ligne(CHEMINS.titre, { title: "Titre du commun", virtual: true, group: "Proposition" }),
  ligne(CHEMINS.budget, { title: "Budget", total: 1, last: 1_757_000_200, group: "Proposition" }),
  ligne(CHEMINS.sansLibelle, { total: 1, last: 1_756_000_000 }),
  ligne(CHEMINS.avis, { title: "Avis du comité", total: 4, unread: 2, last: 1_757_000_300, group: "Bilan" }),
  ligne(CHEMINS.depense, { title: "Hébergement", total: 1, last: 1_757_000_400, kind: "expense", group: "Proposition" }),
  ligne(CHEMINS.depenseSansNom, { total: 1, last: 1_757_000_500, kind: "expense", group: "Proposition" }),
  ligne(CHEMINS.autre, { total: 1, last: 1_757_000_600, kind: "sondage" }),
];

const reponse = (over: Record<string, unknown> = {}) => ({
  result: true,
  space: { type: "answers", id: COMMUN, title: "Titre connu du serveur", formId: APPEL },
  canComment: true,
  truncated: false,
  threads: FILS,
  ...over,
});
const CONNECTE = reponse();
const VISITEUR = reponse({ canComment: false });

type Props = Parameters<typeof SpacePanel>[0];

/**
 * Un refus tel que la façade du SDK le REND : une EXCEPTION, le corps du serveur rangé dans
 * `responseData` — jamais ce corps en valeur de retour (mesuré contre le SDK réel le 09/10).
 */
const refusDuSdk = (code: string) => async (): Promise<never> => {
  throw new cocolightApiClient.error.ApiResponseError("Texte du serveur.", 200, { result: false, code, msg: "Texte du serveur." });
};

interface Montage extends Partial<Props> {
  readonly sert?: unknown | (() => Promise<unknown>);
  /** Une session est ouverte. Par défaut : un visiteur. */
  readonly session?: boolean;
}

/** Le panneau dans ses fournisseurs, prêt à être rendu — et le serveur qu'on lui donne. */
function preparer(options: Montage = {}) {
  const { sert = CONNECTE, session = false, ...props } = options;
  const getDiscussionSpace = vi.fn(typeof sert === "function" ? (sert as () => Promise<unknown>) : async () => sert);
  const cocolight = {
    api: { getDiscussionSpace }, me: session ? { isConnected: true } : null, entity: null, helper: {},
  } as unknown as CocolightContextType;
  const client = new QueryClient();
  const onSelect = vi.fn();
  const arbre = (plus: Partial<Props> = {}): ReactElement => (
    <QueryClientProvider client={client}>
      <CocolightContext.Provider value={cocolight}>
        <LocalizationProvider>
          <SpacePanel space={ESPACE} target={null} onSelect={onSelect} {...props} {...plus} />
        </LocalizationProvider>
      </CocolightContext.Provider>
    </QueryClientProvider>
  );
  return { arbre, getDiscussionSpace, client, onSelect };
}

function monter(options: Montage = {}) {
  const { arbre, ...reste } = preparer(options);
  const rendu = render(arbre());
  return { ...rendu, ...reste, changer: (plus: Partial<Props>) => rendu.rerender(arbre(plus)) };
}

/**
 * Le TOUT PREMIER rendu, celui d'avant les effets : `render` les a déjà joués quand il rend la
 * main, et ce rendu-là ne s'y voit plus. Le rendu en chaîne ne joue aucun effet — c'est lui.
 */
function premierRendu(options: Montage = {}): HTMLElement {
  const { arbre } = preparer(options);
  const racine = document.createElement("div");
  racine.innerHTML = renderToString(arbre());
  return racine;
}

/** Laisse la requête répondre (et, avec un délai, React Query réessayer). */
const servir = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

const panneau = (c: HTMLElement) => c.querySelector("[data-space-panel]")!;
const colonneFils = (c: HTMLElement) => c.querySelector('[data-panel-column="threads"]')!;
const colonneFil = (c: HTMLElement) => c.querySelector('[data-panel-column="thread"]')!;
const filMonte = (c: HTMLElement) => c.querySelector("[data-comment-thread]");
const rangees = (racine: ParentNode) => [...racine.querySelectorAll("[data-thread-row]")].map(r => ({
  cle: r.getAttribute("data-thread-key"),
  titre: r.querySelector("span.line-clamp-2")?.getAttribute("title") ?? null,
  etiquette: r.querySelector("[data-thread-meta] > span[title]")?.getAttribute("title") ?? null,
}));
const groupes = (c: HTMLElement) => [...c.querySelectorAll("[data-thread-group]")].map(g => ({
  intertitre: g.getAttribute("data-thread-group"),
  cles: rangees(g).map(r => r.cle),
}));

describe("SpacePanel", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe("ce qu'il demande, et comment il se nomme", () => {
    it("demande au serveur l'espace de CE commun", async () => {
      const { getDiscussionSpace } = monter();
      await servir();
      expect(getDiscussionSpace).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN });
    });

    it("s'identifie par l'espace qu'il sert", async () => {
      const { container } = monter();
      await servir();
      expect(panneau(container).getAttribute("data-space-panel")).toBe(`answers:${COMMUN}`);
    });

    it("ne se déclare pas « sans recherche » : il n'a ni recherche ni rail, et les règles du rail plié n'ont pas à l'atteindre", async () => {
      // `styles.css` plie le rail sur `[data-search="off"]` : posé ici, l'attribut sortait du flux
      // la pastille de non-lus des FILS, posée en coin de rangée (mesuré au navigateur le 09/10).
      const { container } = monter();
      await servir();
      expect(panneau(container).hasAttribute("data-search")).toBe(false);
      expect(container.querySelector('[data-panel-column="carriers"]')).toBeNull();
    });

    it("prend le titre que la fiche a résolu, avant celui du serveur", async () => {
      const { container } = monter({ title: "Une instance peertube" });
      await servir();
      expect(panneau(container).getAttribute("aria-label")).toBe("Une instance peertube");
      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Une instance peertube");
    });

    it("à défaut, celui que le serveur connaît ; à défaut encore, un nom générique", async () => {
      const { container } = monter();
      await servir();
      expect(panneau(container).getAttribute("aria-label")).toBe("Titre connu du serveur");

      const sansTitre = monter({ sert: reponse({ space: { type: "answers", id: COMMUN, title: null, formId: APPEL } }) });
      await servir();
      expect(panneau(sansTitre.container).getAttribute("aria-label")).toBe("Discussions du commun");
    });

    it("se relit de lui-même tant qu'il est à l'écran", async () => {
      const { getDiscussionSpace } = monter();
      await servir();
      await servir(31_000);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(2);
    });
  });

  describe("la colonne des fils", () => {
    it("garde l'ordre du serveur et range les questions sous leur étape", async () => {
      const { container } = monter();
      await servir();
      expect(groupes(container)).toEqual([
        { intertitre: "", cles: [CLE_GENERALE, cle(CHEMINS.admins), cle(CHEMINS.comite)] },
        { intertitre: "Proposition", cles: [cle(CHEMINS.budget)] },
        // Une question dont l'étape n'a pas de nom : rangée sous un intertitre générique.
        { intertitre: "Questions", cles: [cle(CHEMINS.sansLibelle)] },
        { intertitre: "Bilan", cles: [cle(CHEMINS.avis)] },
        // Les dépenses ont leur propre groupe, quelle que soit l'étape qui les porte.
        { intertitre: "Dépenses", cles: [cle(CHEMINS.depense), cle(CHEMINS.depenseSansNom)] },
        { intertitre: "Autres", cles: [cle(CHEMINS.autre)] },
      ]);
    });

    it("étiquette chaque fil par sa NATURE, et une discussion par son audience", async () => {
      const { container } = monter();
      await servir();
      const etiquettes = Object.fromEntries(rangees(container).map(r => [r.cle, r.etiquette]));
      expect(etiquettes).toEqual({
        [CLE_GENERALE]: "Général",
        [cle(CHEMINS.admins)]: "Admins",
        [cle(CHEMINS.annonces)]: "Publique",
        [cle(CHEMINS.comite)]: "Privée",
        [cle(CHEMINS.titre)]: "Question",
        [cle(CHEMINS.budget)]: "Question",
        [cle(CHEMINS.sansLibelle)]: "Question",
        [cle(CHEMINS.avis)]: "Question",
        [cle(CHEMINS.depense)]: "Dépense",
        [cle(CHEMINS.depenseSansNom)]: "Dépense",
        // Une nature que l'écran ne connaît pas : le fil reste, étiqueté « Discussion ».
        [cle(CHEMINS.autre)]: "Discussion",
      });
    });

    it("une audience que l'écran ne connaît pas se lit comme la plus fermée", async () => {
      // Le serveur ne liste une discussion qu'à son audience ; si une audience nouvelle arrivait un
      // jour, « Admins » est l'étiquette qui ne promet à personne plus qu'elle ne tient.
      const future = ligne(CHEMINS.comite, { title: "Jury", total: 1, last: 1_757_000_100, kind: "discussion", audience: "juryOnly" });
      const { container } = monter({ sert: reponse({ threads: [FILS[0], future] }) });
      await servir();
      expect(rangees(container).find(r => r.cle === cle(CHEMINS.comite))!.etiquette).toBe("Admins");
    });

    it("nomme lui-même les fils que le serveur ne titre pas", async () => {
      const { container } = monter();
      await servir();
      const titres = Object.fromEntries(rangees(container).map(r => [r.cle, r.titre]));
      expect(titres[CLE_GENERALE]).toBe("Discussion générale");
      expect(titres[cle(CHEMINS.sansLibelle)]).toBe("Question sans intitulé");
      expect(titres[cle(CHEMINS.depenseSansNom)]).toBe("Ligne de dépense");
      expect(titres[cle(CHEMINS.autre)]).toBe("Sans titre");
      // Un fil titré garde son titre.
      expect(titres[cle(CHEMINS.budget)]).toBe("Budget");
    });

    it("à qui peut écrire, propose les emplacements vides derrière le pli", async () => {
      const { container } = monter();
      await servir();
      const pli = container.querySelector(".comment-collapsible")!;
      expect(rangees(pli).map(r => r.cle)).toEqual([cle(CHEMINS.annonces), cle(CHEMINS.titre)]);
      expect(screen.getByRole("button", { name: "Sans discussion (2)" })).toBeTruthy();
      expect(pli.textContent).toContain("Démarrer la discussion");
    });

    it("à un visiteur, ne propose AUCUN emplacement vide — il n'a rien à y démarrer", async () => {
      const { container } = monter({ sert: VISITEUR });
      await servir();
      expect(container.querySelector("[data-empty-group]")).toBeNull();
      expect(rangees(container).map(r => r.cle)).not.toContain(cle(CHEMINS.titre));
      expect(colonneFils(container).textContent).not.toContain("Démarrer la discussion");
      // Les fils où l'on a écrit, eux, se lisent sans session.
      expect(rangees(container).map(r => r.cle)).toContain(cle(CHEMINS.budget));
    });

    it("garde le fil général même vierge, sans invitation à démarrer pour un visiteur", async () => {
      const vierge = { ...FILS[0], total: 0, unread: 0, last: null, virtual: true };
      const { container } = monter({ sert: reponse({ canComment: false, threads: [vierge, FILS[5]] }) });
      await servir();
      expect(groupes(container)[0]).toEqual({ intertitre: "", cles: [CLE_GENERALE] });
      expect(container.querySelector(`[data-thread-key="${CLE_GENERALE}"] [data-thread-meta]`)!.textContent).toBe("Général");
    });

    it("marque le fil ouvert", async () => {
      const { container } = monter({ target: cible(CHEMINS.budget) });
      await servir();
      const choisie = container.querySelector(`[data-thread-key="${cle(CHEMINS.budget)}"]`)!;
      expect(choisie.getAttribute("data-selected")).toBe("true");
      expect(container.querySelector(`[data-thread-key="${CLE_GENERALE}"]`)!.getAttribute("data-selected")).toBe("false");
    });

    it("remonte le fil cliqué avec sa cible complète, chemin compris", async () => {
      const { container, onSelect } = monter();
      await servir();
      fireEvent.click(container.querySelector(`[data-thread-key="${cle(CHEMINS.avis)}"]`)!);
      expect(onSelect).toHaveBeenCalledWith(cible(CHEMINS.avis));
    });

    it("dit que la liste est partielle quand le serveur l'a coupée", async () => {
      const { container } = monter({ sert: reponse({ truncated: true }) });
      await servir();
      expect(colonneFils(container).textContent).toContain("Affichage partiel");
    });
  });

  describe("le fil choisi", () => {
    it("sans fil choisi, invite à en choisir un et n'en monte aucun", async () => {
      const { container } = monter();
      await servir();
      expect(panneau(container).getAttribute("data-step")).toBe("threads");
      expect(colonneFil(container).textContent).toContain("Choisissez un fil pour l'afficher");
      expect(filMonte(container)).toBeNull();
      expect(container.querySelector("[data-panel-back]")).toBeNull();
    });

    it("monte le fil que le serveur a listé, avec sa cible et l'entité qui cadre les mentions", async () => {
      const { container } = monter({ target: cible(CHEMINS.avis), scopeEntity: { id: "orga-de-l-appel" } as unknown as EntityTypes });
      await servir();
      expect(panneau(container).getAttribute("data-step")).toBe("thread");
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(CHEMINS.avis));
      expect(filMonte(container)!.getAttribute("data-scope")).toBe("orga-de-l-appel");
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Avis du comité");
    });

    it("titre le fil général par son nom d'écran", async () => {
      monter({ target: GENERAL });
      await servir();
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Discussion générale");
    });

    it("ne monte RIEN pour un fil que le serveur n'a pas listé à ce lecteur", async () => {
      // Une discussion réservée désignée par l'adresse : ni son titre, ni ses messages.
      const { container } = monter({ target: cible(CHEMINS.reservee), session: true });
      await servir();
      expect(filMonte(container)).toBeNull();
      expect(container.querySelector("[data-thread-hidden]")!.textContent)
        .toBe("Discussion introuvable, ou dont l'accès est réservé.");
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Messages");
      // Connecté, il n'y a plus rien à lui proposer : c'est bien « non ».
      expect(container.querySelector("[data-login-to-participate]")).toBeNull();
    });

    it("sans session, lui dit que se connecter peut ouvrir ce fil — « réservé » a alors une issue", async () => {
      // Le lien d'une discussion réservée, ouvert par quelqu'un qui n'est pas connecté.
      const { container } = monter({ sert: VISITEUR, target: cible(CHEMINS.reservee) });
      await servir();
      expect(filMonte(container)).toBeNull();
      expect(container.querySelector("[data-thread-hidden]")).toBeTruthy();
      const invitation = colonneFil(container).querySelector('[data-login-to-participate="block"]')!;
      expect(invitation.textContent).toBe("Si elle vous est réservée, connectez-vous pour la lire.");
    });

    it("n'en monte pas davantage pour le fil d'un autre espace", async () => {
      const { container } = monter({ target: { type: "answers", id: "65c3000000000000000000c2", path: null } });
      await servir();
      expect(filMonte(container)).toBeNull();
      expect(container.querySelector("[data-thread-hidden]")).toBeTruthy();
    });

    it("attend la liste avant de monter quoi que ce soit", () => {
      const { container } = monter({ sert: () => new Promise(() => {}), target: GENERAL });
      expect(filMonte(container)).toBeNull();
      expect(container.querySelector("[data-thread-hidden]")).toBeNull();
      expect(colonneFil(container).querySelector('[aria-busy="true"]')!.textContent).toBe("Chargement de la discussion…");
      expect(colonneFils(container).querySelector('[aria-busy="true"]')).toBeTruthy();
    });

    it("au tout premier rendu, CHARGE : ni « introuvable », ni invitation à se connecter, ni liste vide", () => {
      // La requête attend de savoir qui lit. Ce rendu d'attente n'est pas une réponse : un lien
      // vers un fil ne doit pas afficher « introuvable » le temps d'un rendu, même à un visiteur.
      const racine = premierRendu({ sert: VISITEUR, target: cible(CHEMINS.budget) });
      expect(colonneFil(racine).querySelector('[aria-busy="true"]')!.textContent).toBe("Chargement de la discussion…");
      expect(colonneFils(racine).querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(racine.querySelector("[data-thread-hidden]")).toBeNull();
      expect(racine.querySelector("[data-login-to-participate]")).toBeNull();
      expect(racine.querySelector("[data-space-error]")).toBeNull();
      expect(filMonte(racine)).toBeNull();
    });

    it("un visiteur arrivé par un lien sur un emplacement vide y lit le fil, pas « introuvable »", async () => {
      // La colonne ne le lui PROPOSE pas ; le serveur, lui, l'a listé : il peut le lire.
      const { container } = monter({ sert: VISITEUR, target: cible(CHEMINS.titre) });
      await servir();
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(CHEMINS.titre));
      expect(container.querySelector("[data-thread-hidden]")).toBeNull();
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Titre du commun");
    });

    it("REMONTE le fil quand on en change — « répondre à » ne survit pas au passage d'un fil à l'autre", async () => {
      const { container, changer } = monter({ target: cible(CHEMINS.budget) });
      await servir();
      const premier = filMonte(container)!.getAttribute("data-montage");
      changer({ target: cible(CHEMINS.avis) });
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(CHEMINS.avis));
      expect(filMonte(container)!.getAttribute("data-montage")).not.toBe(premier);
    });

    it("la flèche ramène à la liste des fils, et ne ferme rien", async () => {
      const { container, onSelect } = monter({ target: GENERAL });
      await servir();
      fireEvent.click(screen.getByRole("button", { name: "Retour aux fils" }));
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(null);
      expect(panneau(container)).toBeTruthy();
    });
  });

  describe("quand le serveur ne sert pas l'espace", () => {
    it.each([
      ["hidden", "Cet espace de discussion est introuvable."],
      ["bad-request", "Le serveur a refusé la demande."],
    ])("un refus `%s` est dit dans la langue de l'écran, jamais avec le texte du serveur", async (code, phrase) => {
      const { container, getDiscussionSpace } = monter({ sert: refusDuSdk(code), target: GENERAL });
      await servir();
      // Un refus n'est pas une panne : dit aussitôt, sans nouvelle tentative.
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(colonneFils(container).querySelector("[data-space-error]")!.textContent).toBe(phrase);
      // Le fil visé n'est pas monté, et sa colonne dit la même chose que la liste.
      expect(filMonte(container)).toBeNull();
      expect(colonneFil(container).textContent).toContain(phrase);
      expect(container.textContent).not.toContain("Texte du serveur.");
      expect(rangees(container)).toEqual([]);
    });

    it("porte le code du refus sur un attribut", async () => {
      const { container } = monter({ sert: refusDuSdk("hidden") });
      await servir();
      expect(container.querySelector("[data-space-error]")!.getAttribute("data-space-error")).toBe("hidden");
    });

    it("une panne est dite comme telle, après les nouvelles tentatives", async () => {
      const { container } = monter({ sert: async () => { throw new Error("Network Error"); } });
      await servir();
      await servir(10_000);
      expect(container.querySelector("[data-space-error]")!.getAttribute("data-space-error")).toBe("failed");
      expect(colonneFils(container).textContent).toContain("Les discussions n'ont pas pu être chargées.");
    });

    it("une panne de RELECTURE ne vide pas l'écran : la liste déjà servie reste, le fil aussi", async () => {
      const { container, getDiscussionSpace, client } = monter({ target: cible(CHEMINS.budget) });
      await servir();
      const montage = filMonte(container)!.getAttribute("data-montage");

      getDiscussionSpace.mockRejectedValue(new Error("Network Error"));
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(getDiscussionSpace.mock.calls.length).toBeGreaterThan(1);
      expect(container.querySelector("[data-space-error]")).toBeNull();
      expect(rangees(container).length).toBeGreaterThan(0);
      // Démonter le fil emporterait le brouillon en cours de frappe.
      expect(filMonte(container)!.getAttribute("data-montage")).toBe(montage);
    });

    it("un REFUS à la relecture, lui, retire tout : la liste déjà servie et le fil ouvert", async () => {
      // Le serveur a répondu, et il ne montre plus cet espace — garder l'ancienne liste serait le contredire.
      const { container, getDiscussionSpace, client } = monter({ target: cible(CHEMINS.budget) });
      await servir();
      expect(filMonte(container)).toBeTruthy();

      getDiscussionSpace.mockImplementation(refusDuSdk("hidden"));
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(container.querySelector("[data-space-error]")!.getAttribute("data-space-error")).toBe("hidden");
      expect(rangees(container)).toEqual([]);
      expect(filMonte(container)).toBeNull();
      expect(colonneFil(container).textContent).toContain("Cet espace de discussion est introuvable.");
    });
  });

  describe("la croix de la modale", () => {
    it("est posée dans les DEUX en-têtes, et celle de la liste s'efface quand les colonnes coexistent", async () => {
      const { container } = monter({ headerEnd: <button type="button" data-croix>fermer</button> });
      await servir();
      const croixListe = colonneFils(container).querySelector("[data-croix]")!;
      const croixFil = colonneFil(container).querySelector("[data-croix]")!;
      // En une colonne, l'en-tête du fil n'est pas à l'écran : sans la première, pas de croix du tout.
      expect(croixListe.parentElement!.className).toContain("@3xl/panneau:hidden");
      expect(croixFil.parentElement!.className).not.toContain("hidden");
    });

    it("n'est rendue nulle part quand l'hôte n'en donne pas", async () => {
      const { container } = monter();
      await servir();
      expect(container.querySelectorAll("header .ms-auto")).toHaveLength(0);
    });
  });

  /**
   * En une colonne, changer d'étape retire de l'écran celle d'où l'on vient : sans focus rendu au
   * titre qui arrive, le lecteur d'écran reste sur un bouton qui n'est plus affiché. À deux
   * colonnes rien ne disparaît, et déplacer le focus arracherait l'utilisateur à ce qu'il faisait.
   */
  describe("le focus au changement d'étape", () => {
    const largeurDuPanneau = (px: number) =>
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(px);

    it("en une colonne, passe au titre du fil qui s'ouvre, puis à celui de la liste au retour", async () => {
      largeurDuPanneau(400);
      const { changer } = monter();
      await servir();
      changer({ target: GENERAL });
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3 }));
      changer({ target: null });
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 }));
    });

    it("à deux colonnes, ne déplace pas le focus", async () => {
      largeurDuPanneau(1200);
      const { changer } = monter();
      await servir();
      changer({ target: GENERAL });
      expect(document.activeElement).toBe(document.body);
    });

    it.each([
      [767, "le déplace encore : une seule colonne"],
      [768, "ne le déplace plus : les deux colonnes coexistent"],
    ])("au seuil de 48 rem — à %i px, %s", async (largeur) => {
      // 48 rem × 16 px : la largeur exacte où `styles.css` passe à deux colonnes.
      largeurDuPanneau(largeur);
      const { changer } = monter();
      await servir();
      changer({ target: GENERAL });
      const attendu = largeur < 768 ? screen.getByRole("heading", { level: 3 }) : document.body;
      expect(document.activeElement).toBe(attendu);
    });

    it("sans largeur mesurable (panneau masqué), ne déplace rien", async () => {
      // `offsetWidth` vaut 0 pour un élément non affiché : ce n'est pas « une colonne ».
      largeurDuPanneau(0);
      const { changer } = monter();
      await servir();
      changer({ target: GENERAL });
      expect(document.activeElement).toBe(document.body);
    });

    it("ne le déplace pas non plus en passant d'un fil à un autre — l'étape n'a pas changé", async () => {
      largeurDuPanneau(400);
      const { changer } = monter({ target: GENERAL });
      await servir();
      changer({ target: cible(CHEMINS.budget) });
      expect(document.activeElement).toBe(document.body);
    });
  });
});
