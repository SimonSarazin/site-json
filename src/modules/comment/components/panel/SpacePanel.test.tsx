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

// jsdom ne fournit pas ResizeObserver, dont le groupe de boutons radio de Radix a besoin (formulaire de création).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

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
const UTILISATEUR = "65d4000000000000000000d1";
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
  // Celle qu'on crée d'ici : la clé et le chemin sont fabriqués par le serveur.
  creee: `${APPEL}.moreDiscussions_93015AbCdEfGh.${COMMUN}.discu_121020269301512.comment`,
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
/** Un lecteur à qui le serveur annonce qu'il peut créer : le déposant du commun, par exemple. */
const PEUT_CREER = reponse({ creatableAudiences: ["authorAll", "authorAdmin"] });
/** La discussion créée, telle que le serveur la rend : vide, et déjà rangée sous son audience. */
const CREEE = ligne(CHEMINS.creee, { title: "Budget 2026", virtual: true, kind: "discussion", audience: "authorAdmin" });
/**
 * Ce qu'un VISITEUR reçoit, et pas davantage : le serveur ne lui liste aucune discussion réservée,
 * et sans session il n'y a ni non-lu ni « à moi » à calculer. C'est le serveur qui filtre, pas l'écran.
 */
const VISITEUR = reponse({
  canComment: false,
  threads: FILS
    .filter(fil => fil.audience !== "private" && fil.audience !== "authorAdmin")
    .map(fil => ({ ...fil, unread: 0, mine: false })),
});

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
  /** Ce que répond la création d'une discussion. Par défaut : la discussion créée. */
  readonly cree?: (corps: Record<string, unknown>) => Promise<unknown>;
  /**
   * Une session est ouverte. Par défaut, ce que la réponse servie suppose : le serveur ne dit
   * « peut écrire » qu'à une session — servir l'un sans l'autre jouerait un cas qui n'existe pas.
   */
  readonly session?: boolean;
}

/** Le panneau dans ses fournisseurs, prêt à être rendu — et le serveur qu'on lui donne. */
function preparer(options: Montage = {}) {
  const { sert = CONNECTE, cree = async () => ({ result: true, thread: CREEE }), ...reste } = options;
  const sansSession = typeof sert === "object" && sert !== null && (sert as { canComment?: unknown }).canComment === false;
  const { session = !sansSession, ...props } = reste;
  const getDiscussionSpace = vi.fn(typeof sert === "function" ? (sert as () => Promise<unknown>) : async () => sert);
  const createDiscussion = vi.fn(cree);
  const cocolight = {
    api: { getDiscussionSpace, createDiscussion },
    me: session ? { isConnected: true } : null,
    // La clé de cache porte le lecteur : une session sans lui rangerait sa liste sous celle du visiteur.
    entity: session ? { userContext: { id: UTILISATEUR } } : null,
    helper: {},
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
  return { arbre, getDiscussionSpace, createDiscussion, client, onSelect };
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
const lireGroupes = (elements: readonly Element[]) => elements.map(g => ({
  intertitre: g.getAttribute("data-thread-group"),
  cles: rangees(g).map(r => r.cle),
}));
/** Les groupes de fils où l'on a écrit — hors du pli « Sans discussion ». */
const groupes = (c: HTMLElement) =>
  lireGroupes([...c.querySelectorAll("[data-thread-group]")].filter(g => !g.closest("[data-empty-group]")));
/** Les groupes du pli « Sans discussion ». */
const groupesVierges = (c: HTMLElement) => lireGroupes([...c.querySelectorAll("[data-empty-group] [data-thread-group]")]);
/** La région que lit un lecteur d'écran quand l'espace change d'état. */
const annonce = (c: HTMLElement) => c.querySelector("[data-space-status]")!;

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

    it("dans le pli aussi, une question se range sous SON étape — deux questions de même libellé s'y distinguent", async () => {
      const homonyme = ligne(question(ETAPE_2, "titre"), { title: "Titre du commun", virtual: true, group: "Bilan" });
      const { container } = monter({ sert: reponse({ threads: [...FILS.slice(0, 8), homonyme, ...FILS.slice(8)] }) });
      await servir();
      expect(groupesVierges(container)).toEqual([
        { intertitre: "", cles: [cle(CHEMINS.annonces)] },
        { intertitre: "Proposition", cles: [cle(CHEMINS.titre)] },
        { intertitre: "Bilan", cles: [cle(question(ETAPE_2, "titre"))] },
      ]);
      // Chaque liste du pli a un nom, comme celles du dessus : l'intertitre, ou à défaut celui du pli.
      const noms = [...container.querySelectorAll("[data-empty-group] ul")].map(ul => ul.getAttribute("aria-label"));
      expect(noms).toEqual(["Sans discussion (3)", "Proposition", "Bilan"]);
    });

    it("un fil qui prend la tête de son groupe ne remonte pas les rangées voisines — le focus qu'on y tenait reste", async () => {
      // La première question d'une étape reçoit son premier message : elle quitte le pli et passe
      // devant « Budget ». La clé du groupe suivait son premier fil : tout le groupe était remonté.
      const { container, getDiscussionSpace, client } = monter();
      await servir();
      const budget = container.querySelector<HTMLElement>(`[data-thread-key="${cle(CHEMINS.budget)}"]`)!;
      budget.focus();
      expect(document.activeElement).toBe(budget);

      const commentee = FILS.map(fil => (fil.key === cle(CHEMINS.titre) ? { ...fil, virtual: false, total: 1, last: 1_758_000_900 } : fil));
      getDiscussionSpace.mockResolvedValue(reponse({ threads: commentee }));
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(groupes(container)[1]).toEqual({ intertitre: "Proposition", cles: [cle(CHEMINS.titre), cle(CHEMINS.budget)] });
      expect(container.querySelector(`[data-thread-key="${cle(CHEMINS.budget)}"]`)).toBe(budget);
      expect(document.activeElement).toBe(budget);
    });

    it("un groupe qui apparaît au-dessus ne remonte pas non plus les suivants", async () => {
      const sansDiscussions = FILS.filter(fil => fil.kind !== "discussion");
      const { container, getDiscussionSpace, client } = monter({ sert: reponse({ threads: sansDiscussions.slice(1) }) });
      await servir();
      const avis = container.querySelector<HTMLElement>(`[data-thread-key="${cle(CHEMINS.avis)}"]`)!;
      avis.focus();

      // Le fil général reçoit son premier message : un groupe de plus, en tête.
      getDiscussionSpace.mockResolvedValue(reponse({ threads: sansDiscussions }));
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(groupes(container)[0]).toEqual({ intertitre: "", cles: [CLE_GENERALE] });
      expect(container.querySelector(`[data-thread-key="${cle(CHEMINS.avis)}"]`)).toBe(avis);
      expect(document.activeElement).toBe(avis);
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

    it("une panne peut se RÉESSAYER : le bouton relance la demande, et la liste arrive", async () => {
      const { container, getDiscussionSpace } = monter({ sert: async () => { throw new Error("Network Error"); } });
      await servir();
      await servir(10_000);
      const avant = getDiscussionSpace.mock.calls.length;
      getDiscussionSpace.mockResolvedValue(CONNECTE);
      await act(async () => {
        fireEvent.click(colonneFils(container).querySelector("[data-space-error] button")!);
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getDiscussionSpace.mock.calls.length).toBe(avant + 1);
      expect(container.querySelector("[data-space-error]")).toBeNull();
      expect(rangees(container).length).toBeGreaterThan(0);
    });

    it("un REFUS, lui, ne propose pas de réessayer : il ne changera pas d'avis", async () => {
      const { container } = monter({ sert: refusDuSdk("hidden") });
      await servir();
      expect(container.querySelector("[data-space-error]")).toBeTruthy();
      expect(container.querySelector("[data-space-error] button")).toBeNull();
    });

    /**
     * Sous 48 rem une seule colonne est à l'écran, et un fil ouvert montre la SIENNE : la panne s'y
     * lisait sans issue, le bouton étant resté dans la liste (vu au navigateur à 375 px, le 12/10).
     */
    const reessayerDuFil = (container: HTMLElement) =>
      Array.from(colonneFil(container).querySelectorAll("button")).find(bouton => bouton.textContent === "Réessayer") ?? null;

    it("fil ouvert, la colonne du FIL offre aussi « Réessayer » : en une colonne, la liste n'est pas à l'écran", async () => {
      const { container, getDiscussionSpace } = monter({ sert: async () => { throw new Error("Network Error"); }, target: GENERAL });
      await servir();
      await servir(10_000);
      expect(colonneFil(container).textContent).toContain("Les discussions n'ont pas pu être chargées.");
      const bouton = reessayerDuFil(container);
      expect(bouton).toBeTruthy();
      const avant = getDiscussionSpace.mock.calls.length;
      getDiscussionSpace.mockResolvedValue(CONNECTE);
      await act(async () => {
        fireEvent.click(bouton!);
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getDiscussionSpace.mock.calls.length).toBe(avant + 1);
      expect(reessayerDuFil(container)).toBeNull();
      expect(filMonte(container)).toBeTruthy();
    });

    it("ce second bouton cède la place dès que les deux colonnes coexistent ; celui de la liste, jamais", async () => {
      const { container } = monter({ sert: async () => { throw new Error("Network Error"); }, target: GENERAL });
      await servir();
      await servir(10_000);
      expect(reessayerDuFil(container)!.className).toContain("@3xl/panneau:hidden");
      expect(colonneFils(container).querySelector("[data-space-error] button")!.className).not.toContain("@3xl/panneau:hidden");
    });

    it("un REFUS n'en propose pas là non plus", async () => {
      const { container } = monter({ sert: refusDuSdk("hidden"), target: GENERAL });
      await servir();
      expect(colonneFil(container).textContent).toContain("Cet espace de discussion est introuvable.");
      expect(reessayerDuFil(container)).toBeNull();
    });

    it("une réponse ILLISIBLE dès l'ouverture est une panne : réessayée, dite, et réessayable", async () => {
      // Une page d'erreur servie en HTTP 200 : le SDK la rend telle quelle, ce n'est pas un objet.
      const { container, getDiscussionSpace } = monter({ sert: "<html>Maintenance</html>" });
      await servir();
      await servir(10_000);
      expect(getDiscussionSpace).toHaveBeenCalledTimes(3);
      const erreur = container.querySelector("[data-space-error]")!;
      expect(erreur.getAttribute("data-space-error")).toBe("unreadable");
      expect(erreur.querySelector("p")!.textContent).toBe("Le serveur a renvoyé une réponse illisible.");
      expect(erreur.querySelector("button")!.textContent).toBe("Réessayer");
    });

    it("une réponse ILLISIBLE à la relecture ne vide pas l'écran non plus : personne n'a dit non", async () => {
      const { container, getDiscussionSpace, client } = monter({ target: cible(CHEMINS.budget) });
      await servir();
      const montage = filMonte(container)!.getAttribute("data-montage");

      getDiscussionSpace.mockResolvedValue("<html>Maintenance</html>");
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(getDiscussionSpace.mock.calls.length).toBeGreaterThan(1);
      expect(container.querySelector("[data-space-error]")).toBeNull();
      expect(rangees(container).length).toBeGreaterThan(0);
      expect(filMonte(container)!.getAttribute("data-montage")).toBe(montage);
      expect(annonce(container).textContent).toBe("");
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

  /**
   * Les deux colonnes affichent la même phrase, et l'une des deux est hors écran en mode une
   * colonne : ce qui arrive à l'espace se dit donc UNE fois, dans une région à part, toujours là.
   */
  describe("ce qu'entend un lecteur d'écran", () => {
    it("rien tant que tout va bien — la région existe, vide, avant d'avoir quoi que ce soit à dire", async () => {
      const racine = premierRendu({ target: GENERAL });
      expect(annonce(racine).getAttribute("role")).toBe("status");
      expect(annonce(racine).textContent).toBe("");

      const { container } = monter({ target: GENERAL });
      await servir();
      expect(annonce(container).textContent).toBe("");
    });

    it("le refus de l'espace, dans la langue de l'écran", async () => {
      const { container } = monter({ sert: refusDuSdk("hidden"), target: GENERAL });
      await servir();
      expect(annonce(container).textContent).toBe("Cet espace de discussion est introuvable.");
    });

    it("la panne, quand il n'y a plus rien à montrer", async () => {
      const { container } = monter({ sert: async () => { throw new Error("Network Error"); } });
      await servir();
      await servir(10_000);
      expect(annonce(container).textContent).toBe("Les discussions n'ont pas pu être chargées.");
    });

    it("le fil de l'adresse que la liste ne porte pas — et seulement une fois la liste arrivée", async () => {
      const { container } = monter({ target: cible(CHEMINS.reservee) });
      expect(annonce(container).textContent).toBe("");
      await servir();
      expect(annonce(container).textContent).toBe("Discussion introuvable, ou dont l'accès est réservé.");
    });

    it("rien non plus sans fil choisi : il n'y a pas de fil à dire introuvable", async () => {
      const { container } = monter();
      await servir();
      expect(annonce(container).textContent).toBe("");
    });
  });

  /**
   * Le bouton « + » de l'espace legacy. Qui crée, et avec quelle audience, c'est le serveur qui le
   * dit (`creatableAudiences`) : l'écran n'offre rien de plus.
   */
  /**
   * Le fil d'une ligne de dépense que personne n'a commentée : le serveur le PROPOSE, et la
   * colonne aussi — arbitré le 12/10 —, à qui peut écrire, comme une question ouverte aux
   * commentaires : dans le pli « Sans discussion », sous l'intertitre des dépenses.
   */
  describe("une ligne de dépense où personne n'a écrit", () => {
    const VIERGE = `${question(ETAPE_2, "financer")}.financement.depensekey.aapStep1-depense.depenseindex.2`;
    const avecLigne = (over: Record<string, unknown> = {}) => reponse({
      threads: [...FILS, ligne(VIERGE, { title: "Matériel", virtual: true, kind: "expense", group: "Bilan", line: "2" })],
      ...over,
    });
    const clesListees = (c: HTMLElement) => rangees(colonneFils(c)).map(r => r.cle);
    const clesDuPli = (c: HTMLElement) => groupesVierges(c).flatMap(g => g.cles);

    it("est proposée à qui peut écrire, dans le pli « Sans discussion » — la ligne commentée, elle, est au-dessus", async () => {
      const { container } = monter({ sert: avecLigne() });
      await servir();
      expect(clesDuPli(container)).toContain(cle(VIERGE));
      // Sous l'intertitre des dépenses, comme les lignes commentées au-dessus du pli.
      expect(groupesVierges(container).find(g => g.cles.includes(cle(VIERGE)))?.intertitre).toBe("Dépenses");
      expect(groupes(container).find(g => g.cles.includes(cle(CHEMINS.depense)))?.intertitre).toBe("Dépenses");
      expect(clesDuPli(container)).not.toContain(cle(CHEMINS.depense));
      expect(groupes(container).flatMap(g => g.cles)).toContain(cle(CHEMINS.depense));
    });

    it("ouverte (par le palier, ou par un lien) : le fil est monté, titré, et sa rangée se LIT sous l'en-tête du pli replié, sélectionnée", async () => {
      const { container } = monter({ sert: avecLigne(), target: cible(VIERGE) });
      await servir();
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(VIERGE));
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Matériel");
      const rangee = colonneFils(container).querySelector(`[data-thread-key="${cle(VIERGE)}"]`)!;
      expect(rangee.getAttribute("data-selected")).toBe("true");
      // Le pli est replié, et pourtant on voit où l'on est : la rangée n'est pas dans sa partie inerte.
      expect(container.querySelector("[data-empty-group]")!.getAttribute("data-open")).toBe("false");
      expect(rangee.closest("[data-empty-current]")).not.toBeNull();
      expect(rangee.closest("[inert]")).toBeNull();
    });

    it("on en sort : elle reste proposée, rentrée dans le pli, sans la sélection", async () => {
      const { container, changer } = monter({ sert: avecLigne(), target: cible(VIERGE) });
      await servir();
      changer({ target: cible(CHEMINS.avis) });
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(CHEMINS.avis));
      const rangee = colonneFils(container).querySelector(`[data-thread-key="${cle(VIERGE)}"]`)!;
      expect(rangee.getAttribute("data-selected")).toBe("false");
      expect(rangee.closest("[inert]")).not.toBeNull();
      expect(container.querySelector("[data-empty-current]")).toBeNull();
    });

    it("pour un visiteur : pas de rangée — et par un lien, le fil est monté, il y lira l'invitation à se connecter", async () => {
      const { container } = monter({ sert: avecLigne({ canComment: false }), target: cible(VIERGE) });
      await servir();
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(VIERGE));
      expect(clesListees(container)).not.toContain(cle(VIERGE));
      // La ligne commentée, elle, se lit sans session.
      expect(clesListees(container)).toContain(cle(CHEMINS.depense));
    });
  });

  describe("créer une discussion", () => {
    const plus = () => screen.queryByRole("button", { name: "Nouvelle discussion" });
    const formulaire = (c: HTMLElement) => c.querySelector("[data-new-discussion]");
    const ouvrirLeFormulaire = async (options: Montage = {}) => {
      const rendu = monter({ sert: PEUT_CREER, ...options });
      await servir();
      fireEvent.click(plus()!);
      return rendu;
    };
    const creer = async () => {
      fireEvent.change(screen.getByLabelText("Nom de la discussion"), { target: { value: "Budget 2026" } });
      await act(async () => {
        fireEvent.submit(document.querySelector("[data-new-discussion]")!);
        await vi.advanceTimersByTimeAsync(0);
      });
    };

    it("ne l'offre pas à qui le serveur n'annonce aucune audience — connecté compris", async () => {
      const { container } = monter();
      await servir();
      expect(plus()).toBeNull();
      expect(formulaire(container)).toBeNull();
    });

    it("ne l'offre pas à un visiteur", async () => {
      monter({ sert: VISITEUR });
      await servir();
      expect(plus()).toBeNull();
    });

    it("l'offre à qui il en annonce, dans l'en-tête de la liste — formulaire fermé", async () => {
      const { container } = monter({ sert: PEUT_CREER });
      await servir();
      expect(colonneFils(container).querySelector("header")!.contains(plus())).toBe(true);
      // Un bouton sans texte : son nom est dit au lecteur d'écran, et montré au survol.
      expect(plus()!.getAttribute("aria-label")).toBe("Nouvelle discussion");
      expect(plus()!.getAttribute("title")).toBe("Nouvelle discussion");
      expect(plus()!.getAttribute("aria-expanded")).toBe("false");
      expect(formulaire(container)).toBeNull();
    });

    it("le « + » ouvre le formulaire en tête de la colonne, au-dessus des fils — et le referme", async () => {
      const { container } = await ouvrirLeFormulaire();
      const boite = formulaire(container)!;
      expect(plus()!.getAttribute("aria-expanded")).toBe("true");
      expect(colonneFils(container).contains(boite)).toBe(true);
      // Avant la liste dans la colonne : on ne le cherche pas sous quarante fils.
      const premiereRangee = container.querySelector("[data-thread-row]")!;
      expect(boite.compareDocumentPosition(premiereRangee) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(plus()!);
      expect(formulaire(container)).toBeNull();
      expect(plus()!.getAttribute("aria-expanded")).toBe("false");
    });

    it("un double clic sur le « + » ouvre, et ne referme pas : son second clic ne compte pas", async () => {
      const { container } = monter({ sert: PEUT_CREER });
      await servir();
      fireEvent.click(plus()!, { detail: 1 });
      fireEvent.click(plus()!, { detail: 2 });
      expect(formulaire(container)).not.toBeNull();
      expect(plus()!.getAttribute("aria-expanded")).toBe("true");
      // … et dans l'autre sens : ouvert, un double clic le referme, sans le rouvrir.
      fireEvent.click(plus()!, { detail: 1 });
      fireEvent.click(plus()!, { detail: 2 });
      expect(formulaire(container)).toBeNull();
      // Au clavier (`detail` nul), chaque activation compte.
      fireEvent.click(plus()!, { detail: 0 });
      expect(formulaire(container)).not.toBeNull();
    });

    it("n'y offre que les audiences annoncées", async () => {
      await ouvrirLeFormulaire();
      expect(screen.getAllByRole("radio").map(radio => document.querySelector(`label[for="${radio.id}"]`)!.textContent)).toEqual(["Publique", "Privée"]);
    });

    it("« Annuler » referme le formulaire et rend le focus au « + »", async () => {
      const { container } = await ouvrirLeFormulaire();
      fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
      expect(formulaire(container)).toBeNull();
      expect(document.activeElement).toBe(plus());
    });

    it("demande au serveur de créer la discussion sur CET espace", async () => {
      const { createDiscussion } = await ouvrirLeFormulaire();
      await creer();
      expect(createDiscussion).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN, name: "Budget 2026", audience: "authorAdmin" });
    });

    it("créée, la discussion est OUVERTE aussitôt, et le formulaire se referme", async () => {
      const { container, onSelect } = await ouvrirLeFormulaire();
      await creer();
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(cible(CHEMINS.creee));
      expect(formulaire(container)).toBeNull();
    });

    it("elle se monte SANS attendre la relecture : la liste la porte déjà — jamais « introuvable »", async () => {
      // La relecture qui suit la création ne répond pas encore : seule la liste en cache fait foi.
      let lectures = 0;
      const { container, onSelect, changer } = await ouvrirLeFormulaire({
        sert: () => (lectures++ === 0 ? Promise.resolve(PEUT_CREER) : new Promise(() => {})),
      });
      await creer();
      changer({ target: onSelect.mock.calls[0][0] as CommentTarget });
      expect(filMonte(container)!.getAttribute("data-target")).toBe(cle(CHEMINS.creee));
      expect(container.querySelector("[data-thread-hidden]")).toBeNull();
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Budget 2026");
      // Dans la colonne, elle attend son premier message avec les autres emplacements vides — sous
      // « Sans discussion » —, mais ouverte elle s'y LIT, sous l'en-tête du pli replié.
      expect(rangees(container.querySelector("[data-empty-group]")!).map(r => r.cle)).toContain(cle(CHEMINS.creee));
      expect(rangees(container.querySelector("[data-empty-current]")!).map(r => r.cle)).toEqual([cle(CHEMINS.creee)]);
      expect(rangees(container.querySelector(".comment-collapsible")!).map(r => r.cle)).not.toContain(cle(CHEMINS.creee));
    });

    it("son titre reçoit le focus quand elle s'ouvre — le formulaire qui le tenait a disparu", async () => {
      const { onSelect, changer } = await ouvrirLeFormulaire();
      await creer();
      changer({ target: onSelect.mock.calls[0][0] as CommentTarget });
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3 }));
    });

    it("créée mais pas ouverte par l'hôte : le fil qu'on ouvre ENSUITE ne prend pas le focus à sa place", async () => {
      // L'hôte peut ne pas suivre (un fil que l'adresse ne saurait pas relire) : le focus promis à
      // la discussion créée n'est pas à donner au premier fil venu.
      const { changer } = await ouvrirLeFormulaire();
      await creer();
      const avant = document.activeElement;
      changer({ target: cible(CHEMINS.budget) });
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Budget");
      expect(document.activeElement).toBe(avant);
    });

    it("changer de fil sans avoir rien créé ne déplace pas le focus", async () => {
      const { changer } = await ouvrirLeFormulaire();
      const champ = screen.getByLabelText("Nom de la discussion");
      changer({ target: cible(CHEMINS.budget) });
      expect(document.activeElement).toBe(champ);
    });

    it("refusée, elle laisse le formulaire ouvert avec sa raison — et rien n'est ouvert", async () => {
      const { container, onSelect } = await ouvrirLeFormulaire({ cree: refusDuSdk("forbidden") });
      await creer();
      expect(screen.getByRole("alert").textContent).toBe("Vous ne pouvez pas créer cette discussion.");
      expect(formulaire(container)).toBeTruthy();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("sous un refus de l'espace, pas de « + » : il n'y a rien où créer", async () => {
      monter({ sert: refusDuSdk("hidden") });
      await servir();
      expect(plus()).toBeNull();
    });

    it("le droit de créer retiré par une relecture retire le « + » et le formulaire ouvert", async () => {
      const { container, getDiscussionSpace, client } = await ouvrirLeFormulaire();
      expect(formulaire(container)).toBeTruthy();
      getDiscussionSpace.mockResolvedValue(CONNECTE);
      await act(async () => {
        void client.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(plus()).toBeNull();
      expect(formulaire(container)).toBeNull();
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
