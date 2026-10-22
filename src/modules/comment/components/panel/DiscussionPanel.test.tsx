// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { DiscussionCarrier, DiscussionThread } from "../../types";
import { refusalError, unreadableError } from "../../lib/discussions";
import "../../i18n";

const ORG = "65a1000000000000000000a1";
const PROJ = "65a1000000000000000000a2";
const EVT = "65a1000000000000000000a3";
const COOP = "65a1000000000000000000a4";
const ACT = "65b2000000000000000000b1";
const NEWS = "65b2000000000000000000b2";
const FORM = "65b2000000000000000000b3";
const ANS = "65b2000000000000000000b4";

function porteur(over: Partial<DiscussionCarrier> = {}): DiscussionCarrier {
  return {
    id: ORG, type: "organizations", name: "Fabrique des communs", slug: "fabrique", image: null,
    threads: 2, total: 5, unread: 3, last: 1_700_000_000, mine: false, membership: "member", ...over,
  };
}

function fil(over: Partial<DiscussionThread> = {}): DiscussionThread {
  return {
    key: `actions:${ACT}`, target: { type: "actions", id: ACT, path: null },
    title: "Ouvrir le capot", carrier: { type: "organizations", id: ORG },
    total: 4, unread: 0, last: 1_700_000_000, mine: false, virtual: false, ...over,
  };
}

/**
 * Le rail : deux espaces actifs, un espace vierge (donc derrière le pli) et le groupe
 * « sans contexte ». Aucun nom ne contient « ouvrir », aucun titre de fil ne contient
 * « solaire » : c'est ce qui permet à chaque requête de ne viser QU'UNE des deux colonnes.
 */
const ORGA = porteur();
const PROJET = porteur({
  id: PROJ, type: "projects", name: "Toitures solaires", slug: "toitures", threads: 1, unread: 0,
});
const VIERGE = porteur({
  id: EVT, type: "events", name: "Assemblée de printemps", slug: "assemblee",
  threads: 0, total: 0, unread: 0, last: null,
});
const ORPHELINS = porteur({
  id: null, type: null, name: null, slug: null, threads: 1, total: 2, unread: 0,
});
/** N'arrive qu'au rafraîchissement : c'est lui qui prouve qu'un nouveau jeu est bien passé. */
const COOPERATIVE = porteur({
  id: COOP, type: "projects", name: "Coopérative d'énergie", slug: "coop", threads: 1, unread: 0,
});
const PORTEURS = [ORGA, PROJET, VIERGE, ORPHELINS];

const FIL_ORGA = fil();
const FIL_PROJET = fil({
  key: `news:${NEWS}`, target: { type: "news", id: NEWS, path: null },
  title: "Ouvrir la saison", carrier: { type: "projects", id: PROJ }, last: 1_699_500_000,
});
const FIL_ORPHELIN = fil({
  key: `forms:${FORM}`, target: { type: "forms", id: FORM, path: null },
  title: "Ouvrir sans rattachement", carrier: null, last: 1_699_400_000,
});
/**
 * Hors du périmètre transverse, À DESSEIN : il n'existe que sous son porteur.
 *
 * C'est le cas qui révèle la régression du titre de la colonne 3 — un fil vierge ou hors
 * cadrage n'est JAMAIS rendu par le mode `all`, et une recherche ne doit pas pour autant
 * effacer son titre de l'en-tête.
 */
const FIL_HORS_CADRE = fil({
  key: `answers:${ANS}`, target: { type: "answers", id: ANS, path: null },
  title: "Budget prévisionnel", carrier: { type: "organizations", id: ORG }, last: 1_699_000_000,
});

/** Ce que rend le mode `all` : des fils de DEUX porteurs, plus un orphelin. */
const TOUS_LES_FILS = [FIL_ORGA, FIL_PROJET, FIL_ORPHELIN];
/** Ce que rend le mode `carrier`, porteur par porteur. */
const FILS_PAR_PORTEUR: Record<string, readonly DiscussionThread[]> = {
  [`organizations:${ORG}`]: [FIL_ORGA, FIL_HORS_CADRE],
  [`projects:${PROJ}`]: [FIL_PROJET],
  [`events:${EVT}`]: [],
};

/** Ce que le bouchon a reçu : c'est ainsi qu'on prouve QUAND le mode `all` est demandé. */
const appels: { kind: string; enabled: boolean }[] = [];
/** Ce que le test fait varier d'un rendu à l'autre. */
const etat = {
  chargementTransverse: false, rafraichi: false,
  /**
   * Le lien profond (mode `fil`) : en cours par défaut, servi, refusé (`hidden`, `login`, ou un
   * code que l'écran ne connaît pas), en panne (échec, réponse illisible), ou en panne APRÈS un
   * premier accord — React Query garde alors la dernière réponse.
   */
  lienProfond: "attente" as "attente" | "servi" | "cache" | "connexion" | "refus" | "echec" | "illisible"
    | "echecApresAccord" | "illisibleApresAccord" | "refusApresAccord",
  /** Une erreur du rail, quand un test en veut une : refus codé ou échec réseau. */
  railErreur: null as unknown,
  /** L'erreur du rail survient sur une RELECTURE : React Query garde alors la liste déjà servie. */
  railServiAvant: false,
  /** La session : connectée par défaut. */
  connecte: true,
};
/** Ce que le bouton « Réessayer » relance : la requête du lien profond. */
const relireLeLien = vi.fn();

/**
 * L'erreur que rend le lien profond, selon l'état voulu — fabriquée par les VRAIES fabriques de la
 * lecture des réponses, pas recopiée à la main : si leur forme change, ces tests la suivent.
 */
function erreurDuLien(): unknown {
  switch (etat.lienProfond) {
    case "cache": return refusalError("hidden");
    case "connexion": return refusalError("login");
    case "refus":
    case "refusApresAccord": return refusalError("refused");
    case "echec":
    case "echecApresAccord": return new Error("Network Error");
    // Une réponse illisible, telle que la lève la lecture de la réponse : un code, SANS la marque de refus.
    case "illisible":
    case "illisibleApresAccord": return unreadableError();
    default: return null;
  }
}

type Perimetre = { kind: string; carrier?: { type: string; id: string } };

function filsDuPerimetre(scope: Perimetre, servi: boolean): readonly DiscussionThread[] {
  if (!servi) return [];
  if (scope.kind === "all") return TOUS_LES_FILS;
  if (scope.kind === "carrier" && scope.carrier) {
    return FILS_PAR_PORTEUR[`${scope.carrier.type}:${scope.carrier.id}`] ?? [];
  }
  return [];
}

// Les requêtes sont une frontière réseau : les remplacer est légitime. Le panneau lui-même,
// lui, n'est jamais remplacé — c'est la pièce testée. Le prédicat de recherche, les colonnes
// et le marquage ne le sont pas davantage : ce sont eux qu'on met en question.
vi.mock("../../hooks/useDiscussionsQuery", () => ({
  useDiscussionsQuery: (scope: Perimetre, options?: { enabled?: boolean }) => {
    const enabled = options?.enabled ?? true;
    appels.push({ kind: scope.kind, enabled });
    // La requête de LIEN PROFOND est laissée EN COURS : c'est l'état transitoire réel juste
    // après un clic, et c'est lui qui révélait le défaut. La rendre déjà résolue ferait
    // passer le test sans rien prouver. Le périmètre transverse, lui, ne charge que si le
    // test le demande.
    const enAttente = enabled
      && (scope.kind === "thread" || (scope.kind === "all" && etat.chargementTransverse));
    const servi = enabled && !enAttente;
    const rail = etat.rafraichi ? [...PORTEURS, COOPERATIVE] : PORTEURS;
    const vide = { carriers: [], threads: [], truncated: false, scanTruncated: false, carriersTruncated: false, tempsReel: { degrade: true } };
    if (scope.kind === "thread" && enabled && etat.lienProfond !== "attente") {
      const error = erreurDuLien();
      return {
        ...vide, canComment: error === null, isLoading: false, isPending: false,
        isError: error !== null, isSuccess: error === null, error, refetch: relireLeLien,
        // Une réponse déjà servie reste dans `data` à travers une erreur de relecture.
        data: error === null || etat.lienProfond.endsWith("ApresAccord") ? { depth: "fil" } : undefined,
      };
    }
    // Une requête DÉSACTIVÉE n'a jamais d'erreur : le panneau en garde une, au repos, pour les fils.
    if (scope.kind === "rail" && enabled && etat.railErreur) {
      return {
        ...vide, canComment: null, isLoading: false, isPending: false, isError: true, isSuccess: false, error: etat.railErreur,
        ...(etat.railServiAvant ? { carriers: PORTEURS, data: { depth: "rail" } } : {}),
      };
    }
    return {
      carriers: scope.kind === "rail" && servi ? rail : [],
      threads: filsDuPerimetre(scope, servi),
      truncated: false,
      // Le hook rend désormais ces deux drapeaux fins. Les taire enverrait `undefined` aux
      // colonnes, là où le panneau leur passe une valeur.
      scanTruncated: false, carriersTruncated: false,
      canComment: true,
      isLoading: enAttente, isPending: enAttente, isError: false, isSuccess: !enAttente,
      error: null, tempsReel: { degrade: true },
    };
  },
}));
vi.mock("../../hooks/useCarrierEntity", () => ({ useCarrierEntity: () => ({ entity: null }) }));
// La session est une frontière : seul son état de connexion compte ici.
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: etat.connecte ? { id: "e".repeat(24), isConnected: true } : null }),
}));
vi.mock("../CommentThread", () => ({ CommentThread: () => <div data-comment-thread /> }));

const { DiscussionPanel } = await import("./DiscussionPanel");

/** L'URL rendue dans le DOM : c'est le seul moyen d'affirmer que la requête n'y va PAS. */
function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

function arbre(url = "/discussions") {
  return (
    <MemoryRouter initialEntries={[url]}>
      <LocalizationProvider><DiscussionPanel /><SondeUrl /></LocalizationProvider>
    </MemoryRouter>
  );
}

function monter(url = "/discussions") {
  return render(arbre(url));
}

const panneau = (c: HTMLElement) => c.querySelector("[data-discussion-panel]")!;
const champ = (c: HTMLElement) => c.querySelector<HTMLInputElement>("[data-search-row] input")!;
const taper = (c: HTMLElement, valeur: string) =>
  fireEvent.change(champ(c), { target: { value: valeur } });
const colonneFils = (c: HTMLElement) => c.querySelector('[data-panel-column="threads"]')!;
const titreDuFil = (c: HTMLElement) =>
  c.querySelector('[data-panel-column="thread"] h3')!.textContent;
const url = (c: HTMLElement) => c.querySelector("[data-url]")!.textContent;
const modeAllDemande = () => appels.some(a => a.kind === "all" && a.enabled);

/**
 * Ce que cette suite garantit, et qui ne se voit pas à la lecture :
 *   - les trois colonnes sont TOUJOURS montées, quelle que soit la largeur. C'est ce qui
 *     supprime le clignotement à l'hydratation : un hook de media query vaut `false` au rendu
 *     serveur comme au premier rendu client, si bien que les trois colonnes apparaissaient
 *     une fraction de seconde sous 768 px. Le choix est désormais purement CSS ;
 *   - le panneau ne se ferme JAMAIS lui-même — sans quoi « retour aux contextes » fermerait la
 *     modale qui l'héberge.
 */
describe("DiscussionPanel", () => {
  // La préférence de pli survit au démontage — c'est sa raison d'être. Il faut donc la
  // remettre à zéro entre deux tests, sinon le premier qui replie contamine les suivants.
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* stockage refusé */ }
    appels.length = 0;
    etat.chargementTransverse = false;
    etat.lienProfond = "attente";
    etat.railErreur = null;
    etat.railServiAvant = false;
    etat.rafraichi = false;
    etat.connecte = true;
    relireLeLien.mockClear();
  });

  it("monte les trois colonnes, sans rien conditionner à la largeur", () => {
    const { container } = monter();
    expect(container.querySelector('[data-panel-column="carriers"]')).toBeTruthy();
    expect(container.querySelector('[data-panel-column="threads"]')).toBeTruthy();
    expect(container.querySelector('[data-panel-column="thread"]')).toBeTruthy();
  });

  it("pose toujours une étape réelle — jamais la valeur fourre-tout « all »", () => {
    const { container } = monter();
    expect(panneau(container).getAttribute("data-step")).toBe("carriers");
    expect(panneau(container).getAttribute("data-step")).not.toBe("all");
  });

  it("suit la profondeur de l'URL dans `data-step`", () => {
    const { container } = monter(`/discussions?discussion=actions%3A${ACT}`);
    expect(panneau(container).getAttribute("data-step")).toBe("thread");
  });

  it("intitule la première colonne « Contextes », pas « Discussions »", () => {
    monter();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Contextes");
    // Un seul « Discussions » dans tout le panneau : le nom accessible de la région.
    expect(screen.queryAllByRole("heading", { name: "Discussions" })).toHaveLength(0);
  });

  it("ramène à la sélection vide au lieu de fermer quoi que ce soit", () => {
    const { container } = monter(`/discussions?discussion=%40organizations%3A${ORG}`);
    const retours = container.querySelectorAll("[data-panel-back]");
    expect(retours.length).toBeGreaterThan(0);
    fireEvent.click(retours[0]);
    // La sélection est effacée de l'URL ; le panneau, lui, reste monté et visible.
    expect(container.querySelector("[data-discussion-panel]")).toBeTruthy();
    expect(panneau(container).getAttribute("data-step")).toBe("carriers");
  });

  /**
   * Défaut signalé à l'écran le 24/09 : cliquer un fil repliait la section « Sans discussion »,
   * « comme si le clic avait déclenché un rechargement ». Le porteur retombait à `null` le
   * temps que la requête de lien profond rattrape une information qu'on avait déjà — la
   * colonne était alors remplacée par « Choisissez un contexte », donc DÉMONTÉE, et tout son
   * état d'affichage perdu.
   */
  it("ne démonte pas la colonne des fils quand on clique un fil de ce porteur", () => {
    const { container } = monter(`/discussions?discussion=%40organizations%3A${ORG}`);
    expect(container.querySelectorAll("[data-thread-row]").length).toBeGreaterThan(0);
    fireEvent.click(container.querySelector("[data-thread-row]")!);
    // La colonne montre toujours ses fils : ni écran d'attente, ni retour au choix d'espace.
    expect(container.querySelectorAll("[data-thread-row]").length).toBeGreaterThan(0);
    expect(screen.queryByText("Choisissez un contexte")).toBeNull();
  });

  it("annonce l'état du rail, pour que le CSS n'ait rien à deviner", () => {
    const { container } = monter();
    expect(panneau(container).getAttribute("data-rail")).toBe("expanded");
    fireEvent.click(screen.getByRole("button", { name: /Replier les contextes/ }));
    expect(panneau(container).getAttribute("data-rail")).toBe("collapsed");
  });

  /**
   * Le groupe « Sans contexte » n'a pas d'identifiant propre : il se sélectionne en écrivant
   * `?discussion=all`, qui EST son adresse.
   *
   * Cette sélection retombait dans le filet « ce n'est pas un fil » et rendait une clé nulle.
   * Trois conséquences, toutes silencieuses : la rangée cliquée n'était pas marquée, le mode
   * `all` n'était jamais demandé, et la colonne annonçait « aucun fil dans ce contexte » sur un
   * périmètre qu'elle n'avait même pas chargé. Or 52 % des fils de formulaire sont orphelins.
   */
  it("charge et marque le groupe « Sans contexte » quand on le choisit dans le rail", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Sans contexte" }));

    expect(modeAllDemande()).toBe(true);
    expect(screen.getByRole("button", { name: "Sans contexte" }))
      .toHaveAttribute("data-selected", "true");
    // Le fil orphelin est bel et bien rendu — et non un message d'absence.
    expect(screen.getByText("Ouvrir sans rattachement")).toBeInTheDocument();
    expect(screen.queryByText("Aucun fil dans ce contexte")).toBeNull();
  });

  /**
   * La recherche du panneau.
   *
   * Elle se prouve par les attributs `data-*` et par ce que chaque colonne rend : jsdom
   * n'évalue ni les container queries ni les styles calculés, il n'y a donc aucune largeur à
   * mesurer ici. `data-search` EST la cause du basculement de disposition — c'est lui qu'on
   * teste, pas son effet visuel.
   *
   * Le prédicat (`lib/searchDiscussions`) a ses 28 tests à lui : ce qui se joue ici, c'est le
   * câblage — quel périmètre est demandé, quand, et ce que chaque colonne en fait.
   */
  describe("recherche", () => {
    it("pose la barre au-dessus des trois colonnes, et non dans un en-tête de colonne", () => {
      const { container } = monter();
      expect(panneau(container).querySelector("[data-search-row]")).toBeTruthy();
      // Un champ posé dans un en-tête de colonne n'existerait pas sur toute une classe
      // d'écrans : entre 48 et 64 rem de panneau, la colonne des espaces tombe à 3.5 rem.
      expect(container.querySelector("[data-panel-column] [data-search-row]")).toBeNull();
    });

    it("n'entre en recherche qu'au premier caractère non blanc", () => {
      const { container } = monter();
      expect(panneau(container).getAttribute("data-search")).toBe("off");
      taper(container, "s");
      expect(panneau(container).getAttribute("data-search")).toBe("on");
    });

    it("ne bascule sur rien quand la requête n'est faite que d'espaces", () => {
      const { container } = monter();
      taper(container, "   ");
      // Le champ garde ce qu'on a tapé ; c'est `trim()` qui décide du mode, pas la longueur.
      expect(champ(container).value).toBe("   ");
      expect(panneau(container).getAttribute("data-search")).toBe("off");
    });

    it("ne demande le périmètre transverse qu'au premier caractère non blanc", () => {
      const { container } = monter();
      expect(modeAllDemande()).toBe(false);
      taper(container, "   ");
      expect(modeAllDemande()).toBe(false);
      taper(container, "solaire");
      expect(modeAllDemande()).toBe(true);
    });

    it("réduit la colonne des espaces aux porteurs qui correspondent", () => {
      const { container } = monter();
      expect(container.querySelectorAll("[data-carrier-row]")).toHaveLength(4);
      taper(container, "solaire");
      const rangees = container.querySelectorAll("[data-carrier-row]");
      expect(rangees).toHaveLength(1);
      expect(rangees[0].textContent).toContain("Toitures solaires");
    });

    it("bascule la colonne des fils en résultats transverses, chacun nommant son espace", () => {
      const { container } = monter();
      taper(container, "ouvrir");
      const colonne = colonneFils(container);
      expect(colonne.querySelectorAll("[data-thread-row]")).toHaveLength(3);
      expect(colonne.querySelector(`[data-thread-key="actions:${ACT}"]`)!.textContent)
        .toContain("Fabrique des communs");
      expect(colonne.querySelector(`[data-thread-key="news:${NEWS}"]`)!.textContent)
        .toContain("Toitures solaires");
      // Deux espaces nommés sur trois résultats : le fil orphelin n'en a aucun à nommer.
      expect(colonne.querySelectorAll("[data-thread-space]")).toHaveLength(2);
    });

    it("change le titre de la colonne des fils pendant la recherche", () => {
      const { container } = monter();
      const titre = () => colonneFils(container).querySelector("h3")!.textContent;
      expect(titre()).toBe("Fils");
      taper(container, "ouvrir");
      expect(titre()).toBe("Fils correspondants — tous contextes");
    });

    /**
     * RÉGRESSION. La colonne 3 titrait d'après la liste AFFICHÉE : dès la première frappe, un
     * fil vierge ou hors cadrage disparaissait du périmètre transverse et son titre retombait
     * sur « Messages » alors qu'il était là, sous les yeux. C'est la séparation
     * `filsDuPorteur` / `filsAffiches` qui le corrige.
     */
    it("garde le titre du fil ouvert même quand la recherche ne le remonte pas", () => {
      const { container } = monter(`/discussions?discussion=%40organizations%3A${ORG}`);
      fireEvent.click(container.querySelector(`[data-thread-key="answers:${ANS}"]`)!);
      expect(titreDuFil(container)).toBe("Budget prévisionnel");

      taper(container, "ouvrir");
      // Le fil ouvert n'est PAS dans le périmètre transverse…
      expect(colonneFils(container).querySelector(`[data-thread-key="answers:${ANS}"]`)).toBeNull();
      // … et son titre reste pourtant en tête de la colonne du fil.
      expect(titreDuFil(container)).toBe("Budget prévisionnel");
      expect(titreDuFil(container)).not.toBe("Messages");
    });

    it("vide la requête et ouvre ses fils quand on choisit un espace", () => {
      const { container } = monter();
      taper(container, "solaire");
      fireEvent.click(screen.getByRole("button", { name: "Toitures solaires" }));
      // Sans cela la colonne des fils resterait en mode transverse, où elle n'écoute pas le
      // porteur : le clic paraîtrait sans effet.
      expect(champ(container).value).toBe("");
      expect(panneau(container).getAttribute("data-search")).toBe("off");
      expect(panneau(container).getAttribute("data-step")).toBe("threads");
      expect(colonneFils(container).querySelector(`[data-thread-key="news:${NEWS}"]`)).toBeTruthy();
    });

    it("retient le porteur du fil transverse cliqué, et ouvre ce fil", () => {
      const { container } = monter();
      taper(container, "ouvrir");
      fireEvent.click(container.querySelector(`[data-thread-key="news:${NEWS}"]`)!);
      expect(panneau(container).getAttribute("data-step")).toBe("thread");
      expect(titreDuFil(container)).toBe("Ouvrir la saison");
      // Le porteur est retenu au clic, sans attendre le lien profond — toujours en cours ici.
      const retenu = screen.getByRole("button", { name: "Toitures solaires" });
      expect(retenu.getAttribute("data-selected")).toBe("true");
      expect(colonneFils(container).querySelector(`[data-thread-key="news:${NEWS}"]`)).toBeTruthy();
    });

    /**
     * RÉGRESSION. `null` disait à la fois « je ne sais pas encore » et « ce fil n'a pas de
     * porteur » : ouvrir un fil orphelin laissait donc en place le porteur PRÉCÉDENT. C'est le
     * tri-état `dernierPorteur` (`CarrierRef | "none" | null`) qui tranche.
     */
    it("ne laisse pas le porteur précédent en place quand on ouvre un fil orphelin", () => {
      const { container } = monter(`/discussions?discussion=%40organizations%3A${ORG}`);
      expect(screen.getByRole("button", { name: /^Fabrique des communs/ })
        .getAttribute("data-selected")).toBe("true");

      taper(container, "ouvrir");
      fireEvent.click(container.querySelector(`[data-thread-key="forms:${FORM}"]`)!);

      // Le rail bascule sur le groupe « sans contexte », et quitte l'ancien porteur…
      expect(screen.getByRole("button", { name: "Sans contexte" })
        .getAttribute("data-selected")).toBe("true");
      expect(screen.getByRole("button", { name: /^Fabrique des communs/ })
        .getAttribute("data-selected")).toBe("false");
      // … et la colonne des fils montre les fils SANS porteur, pas ceux de l'ancien.
      expect(colonneFils(container).querySelector(`[data-thread-key="forms:${FORM}"]`)).toBeTruthy();
      expect(colonneFils(container).querySelector(`[data-thread-key="actions:${ACT}"]`)).toBeNull();
    });

    it("n'annonce aucune absence de résultat tant que le périmètre transverse charge", () => {
      etat.chargementTransverse = true;
      const { container } = monter();
      taper(container, "solaire");
      expect(colonneFils(container).querySelector('[aria-busy="true"]')).toBeTruthy();
      // Dire « rien ne correspond » sur une liste qui n'est pas encore arrivée serait faux.
      expect(screen.queryByText(/ne correspond/)).toBeNull();
      // Le résumé ne compte pas davantage ce qu'il ne sait pas encore.
      expect(container.querySelector("[data-search-count]")!.textContent).toBe("Recherche…");
    });

    it("ouvre le seul résultat quand on valide par Entrée", () => {
      const { container: unFil } = monter();
      taper(unFil, "rattachement");
      fireEvent.keyDown(champ(unFil), { key: "Enter" });
      expect(panneau(unFil).getAttribute("data-step")).toBe("thread");
      expect(titreDuFil(unFil)).toBe("Ouvrir sans rattachement");

      // Le résultat unique peut tout aussi bien être un espace : les deux listes comptent
      // ensemble, et seul le panneau les connaît toutes les deux.
      const { container: unEspace } = monter();
      taper(unEspace, "solaire");
      fireEvent.keyDown(champ(unEspace), { key: "Enter" });
      expect(panneau(unEspace).getAttribute("data-step")).toBe("threads");
      expect(colonneFils(unEspace).querySelector(`[data-thread-key="news:${NEWS}"]`)).toBeTruthy();
    });

    it("ne choisit rien à la place de l'utilisateur quand plusieurs résultats correspondent", () => {
      const { container } = monter();
      taper(container, "ouvrir");
      fireEvent.keyDown(champ(container), { key: "Enter" });
      expect(panneau(container).getAttribute("data-step")).toBe("carriers");
      expect(panneau(container).getAttribute("data-search")).toBe("on");
      expect(champ(container).value).toBe("ouvrir");
    });

    it("ne valide rien tant que le périmètre transverse charge", () => {
      etat.chargementTransverse = true;
      const { container } = monter();
      // « 1 espace + 0 fil » est un total de 1 transitoire et FAUX : la liste des fils n'est
      // pas encore arrivée. Sans le garde, taper vite ouvrirait un espace non choisi.
      taper(container, "solaire");
      fireEvent.keyDown(champ(container), { key: "Enter" });
      expect(panneau(container).getAttribute("data-step")).toBe("carriers");
      expect(url(container)).toBe("");
    });

    it("n'écrit jamais la requête dans l'URL", () => {
      const { container } = monter(`/discussions?discussion=%40organizations%3A${ORG}`);
      const avant = url(container);
      taper(container, "ouvrir");
      // Une adresse partagée ne doit pas imposer un filtre à son destinataire — corollaire :
      // un lien partagé ne transporte jamais de requête.
      expect(url(container)).toBe(avant);
      expect(url(container)).not.toContain("ouvrir");
    });

    it("ne réinitialise ni la requête ni le pli quand les données se rafraîchissent", () => {
      const { container, rerender } = monter();
      // Déplié À LA MAIN, et avant la recherche : sous filtre la section l'est d'office, on
      // ne prouverait rien.
      fireEvent.click(screen.getByRole("button", { name: /sans discussion/i }));
      taper(container, "solaire");

      // Le rafraîchissement du sondage : un jeu de données différent, et plus rien qui charge.
      etat.rafraichi = true;
      rerender(arbre());

      expect(champ(container).value).toBe("solaire");
      expect(panneau(container).getAttribute("data-search")).toBe("on");

      taper(container, "");
      // Les nouvelles données sont bien arrivées…
      expect(screen.getByRole("button", { name: "Coopérative d'énergie" })).toBeTruthy();
      // … et le pli est resté celui qu'on avait laissé.
      expect(container.querySelector("[data-empty-group]")!.getAttribute("data-open")).toBe("true");
    });
  });

  /**
   * Un fil SENSIBLE — une actualité, une discussion de formulaire — ne se monte que sur l'accord
   * du serveur. Refusé, en panne ou en attente, rien de lui n'est affiché.
   */
  describe("fil sensible : monté sur l'accord du serveur seulement (revue du 02/10)", () => {
    const filDActualite = `/discussions?discussion=news%3A${NEWS}`;
    const fil = (c: HTMLElement) => c.querySelector("[data-comment-thread]");

    it("ne monte pas le fil d'une actualité que le serveur refuse (`hidden`)", () => {
      etat.lienProfond = "cache";
      const { container } = monter(filDActualite);
      expect(container.querySelector("[data-thread-hidden]")?.textContent)
        .toBe("Discussion introuvable, ou dont l'accès est réservé.");
      expect(fil(container)).toBeNull();
    });

    it("attend la réponse du serveur avant de monter le fil d'une actualité", () => {
      const { container } = monter(filDActualite);
      expect(fil(container)).toBeNull();
      expect(screen.getByText("Chargement de la discussion…")).toBeTruthy();
    });

    it("une fois la réponse servie, le fil de l'actualité se monte", () => {
      etat.lienProfond = "servi";
      const { container } = monter(filDActualite);
      expect(fil(container)).not.toBeNull();
    });

    it("en anonyme, invite à se connecter pour LIRE, sans monter le fil", () => {
      etat.connecte = false;
      etat.lienProfond = "connexion";
      const { container } = monter(filDActualite);
      expect(container.querySelector('[data-login-to-participate="block"]')?.textContent)
        .toContain("Connectez-vous pour lire cette discussion.");
      expect(fil(container)).toBeNull();
    });

    it("en panne, le dit et propose de réessayer, sans monter le fil", () => {
      etat.lienProfond = "echec";
      const { container } = monter(filDActualite);
      expect(container.querySelector("[data-thread-error]")?.textContent)
        .toContain("Les discussions n'ont pas pu être chargées.");
      expect(screen.queryByText("Network Error")).toBeNull();
      expect(fil(container)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      expect(relireLeLien).toHaveBeenCalledTimes(1);
    });

    it("une panne passagère ne démonte pas un fil déjà accordé — le brouillon partirait avec", () => {
      etat.lienProfond = "echecApresAccord";
      const { container } = monter(filDActualite);
      expect(fil(container)).not.toBeNull();
    });

    it("une réponse illisible non plus : personne n'a dit non, le fil accordé reste", () => {
      etat.lienProfond = "illisibleApresAccord";
      const { container } = monter(filDActualite);
      expect(fil(container)).not.toBeNull();
      expect(container.querySelector("[data-thread-error]")).toBeNull();
    });

    it("un REFUS, lui, démonte le fil déjà accordé — même d'un code que l'écran ne connaît pas", () => {
      etat.lienProfond = "refusApresAccord";
      const { container } = monter(filDActualite);
      expect(fil(container)).toBeNull();
      expect(container.querySelector("[data-thread-error]")?.textContent).toContain("Le serveur a refusé la demande.");
    });

    it("illisible dès l'ouverture : dit comme tel, et réessayable — c'est une panne", () => {
      etat.lienProfond = "illisible";
      const { container } = monter(filDActualite);
      expect(container.querySelector("[data-thread-error]")?.textContent).toContain("Le serveur a renvoyé une réponse illisible.");
      expect(fil(container)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      expect(relireLeLien).toHaveBeenCalledTimes(1);
    });

    it("un refus ne propose pas de réessayer : il ne changera pas d'avis", () => {
      etat.lienProfond = "refus";
      const { container } = monter(filDActualite);
      expect(container.querySelector("[data-thread-error]")?.textContent).toContain("Le serveur a refusé la demande.");
      expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    });

    it("une discussion de formulaire (`path`) attend elle aussi l'accord du serveur", () => {
      const { container } = monter(`/discussions?discussion=forms%3A${FORM}%3AaapStep1.discu_x.comment`);
      expect(panneau(container).getAttribute("data-step")).toBe("thread");
      expect(fil(container)).toBeNull();
      expect(screen.getByText("Chargement de la discussion…")).toBeTruthy();
    });

    it("monte aussitôt le fil d'un élément : sa fiche montre déjà ses messages", () => {
      const { container } = monter(`/discussions?discussion=organizations%3A${ORG}`);
      expect(fil(container)).not.toBeNull();
    });

    it("monte aussitôt le fil racine d'un formulaire : il ne garde que les messages sans `path`", () => {
      const { container } = monter(`/discussions?discussion=forms%3A${FORM}`);
      expect(fil(container)).not.toBeNull();
    });

    /** Ouvre l'actualité depuis la liste de son espace : le serveur vient de la lister. */
    const ouvrirDepuisLaListe = () => {
      const rendu = monter(`/discussions?discussion=%40projects%3A${PROJ}`);
      fireEvent.click(screen.getByRole("button", { name: /Ouvrir la saison/ }));
      return rendu;
    };

    it("un fil que le serveur vient de LISTER se monte sans attendre une seconde fois", () => {
      const { container } = ouvrirDepuisLaListe();
      expect(panneau(container).getAttribute("data-step")).toBe("thread");
      expect(fil(container)).not.toBeNull();
    });

    it("en anonyme, une liste ne vaut pas accord : on attend le serveur", () => {
      etat.connecte = false;
      const { container } = ouvrirDepuisLaListe();
      expect(fil(container)).toBeNull();
    });

    it("un refus `hidden` l'emporte, même sur un fil listé", () => {
      etat.lienProfond = "cache";
      const { container } = ouvrirDepuisLaListe();
      expect(container.querySelector("[data-thread-hidden]")).not.toBeNull();
      expect(fil(container)).toBeNull();
    });
  });

  describe("refus traduits (revue du 29/09)", () => {

    it("traduit un refus du rail d'après son code, sans jamais afficher le texte du serveur", () => {
      etat.railErreur = refusalError("login");
      monter();
      expect(screen.getByText("Connectez-vous pour retrouver vos discussions.")).toBeTruthy();
      expect(screen.queryByText("login")).toBeNull();
    });

    it("un échec réseau du rail est dit comme tel, pas en texte brut", () => {
      etat.railErreur = new Error("Network Error");
      monter();
      expect(screen.getByText("Les discussions n'ont pas pu être chargées.")).toBeTruthy();
      expect(screen.queryByText("Network Error")).toBeNull();
    });
  });

  /**
   * Une PANNE de relecture garde la liste déjà servie (revue du 16/10) : elle la remplaçait par
   * l'erreur pendant 30 s à 1 min, focus perdu et pli refermé. L'espace d'un commun le faisait déjà.
   */
  describe("relecture en panne", () => {
    it("le rail déjà servi RESTE à l'écran : pas de message d'erreur à sa place", () => {
      etat.railErreur = new Error("Network Error");
      etat.railServiAvant = true;
      monter();
      expect(screen.getByText("Toitures solaires")).toBeTruthy();
      expect(screen.queryByText("Les discussions n'ont pas pu être chargées.")).toBeNull();
    });

    it("un REFUS, lui, retire la liste : la session a pu changer", () => {
      etat.railErreur = refusalError("login");
      etat.railServiAvant = true;
      monter();
      expect(screen.getByText("Connectez-vous pour retrouver vos discussions.")).toBeTruthy();
      expect(screen.queryByText("Toitures solaires")).toBeNull();
    });
  });
});
