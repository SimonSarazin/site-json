// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Le PARCOURS entier : le bouton de la fiche, la modale qu'il charge en différé, le panneau, la
 * colonne des fils, le lanceur, l'adresse et l'historique — tous les VRAIS, assemblés.
 *
 * Chaque maillon a ses tests, avec le suivant remplacé. Ce qui passait entre les mailles, et que
 * cette suite tient : un fil cliqué dans la colonne s'écrit dans l'adresse, se RELIT, et c'est lui
 * qui se monte ; la croix et Échap défont l'ouverture dans l'historique du navigateur.
 *
 * Trois frontières seulement : l'appel au serveur, le flux temps réel, et le fil de messages
 * lui-même (son chargement, son composer) — on n'en observe que la cible qu'il reçoit.
 */

const fil = vi.hoisted(() => ({ montages: 0 }));

// jsdom ne fournit pas ResizeObserver, dont le groupe de boutons radio de Radix a besoin (formulaire de création).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/CommentThread", () => ({
  CommentThread: ({ target }: { target?: { type: string; id: string; path?: string | null } | null }) => {
    // Un numéro par MONTAGE : ce qui distingue un fil remonté d'un fil réemployé.
    const [montage] = useState(() => ++fil.montages);
    return (
      <div
        data-comment-thread
        data-montage={montage}
        data-target={target ? `${target.type}:${target.id}${target.path ? `:${target.path}` : ""}` : ""}
      />
    );
  },
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const AUTRE_COMMUN = "65c3000000000000000000c2";
const APPEL = "65c3000000000000000000f1";
const ETAPE = "65c3000000000000000000e1";
const ORGA = { id: "orga-de-l-appel" } as unknown as EntityTypes;

const fiche = (commun: string) => `/aac/commun/${commun}`;
const FICHE = fiche(COMMUN);
const AVANT = "/aac";

const cheminDe = (commun: string, champ: string) => `${APPEL}.${ETAPE}.${commun}.${champ}.question_${champ}.comment`;
const CLE_GENERALE = `answers:${COMMUN}`;
const CLE_BUDGET = `forms:${APPEL}:${cheminDe(COMMUN, "budget")}`;
const CLE_TITRE = `forms:${APPEL}:${cheminDe(COMMUN, "titre")}`;
// La discussion qu'on crée d'ici : sa clé et son chemin sont fabriqués par le serveur.
const CHEMIN_CREE = `${APPEL}.moreDiscussions_93015AbCdEfGh.${COMMUN}.discu_121020269301512.comment`;
const CLE_CREEE = `forms:${APPEL}:${CHEMIN_CREE}`;
const DEPOSANT = "65d4000000000000000000d1";
// Un chemin que l'adresse écrirait, mais ne saurait pas RELIRE (plus de 256 caractères).
const CHEMIN_TROP_LONG = `${cheminDe(COMMUN, "note")}.${"x".repeat(260)}`;
const CLE_TROP_LONGUE = `forms:${APPEL}:${CHEMIN_TROP_LONG}`;

/** L'espace d'un commun, tel que le serveur le rend à un visiteur : des fils où l'on a écrit. */
function espaceDe(commun: string) {
  const ligne = (chemin: string, title: string, total: number) => ({
    key: `forms:${APPEL}:${chemin}`, contextType: "forms", contextId: APPEL, path: chemin, title, carrier: null,
    total, unread: 0, last: 1_757_000_000 + total, mine: false, virtual: false, kind: "question", group: "Proposition", audience: null,
  });
  return {
    result: true,
    space: { type: "answers", id: commun, title: "Titre du serveur", formId: APPEL },
    canComment: false,
    truncated: false,
    threads: [
      { key: `answers:${commun}`, contextType: "answers", contextId: commun, path: null, title: null, carrier: null, total: 3, unread: 0, last: 1_758_000_000, mine: false, virtual: false, kind: "general", group: null, audience: null },
      ligne(cheminDe(commun, "titre"), "Titre du commun", 1),
      ligne(cheminDe(commun, "budget"), "Budget", 2),
      ligne(`${cheminDe(commun, "note")}.${"x".repeat(260)}`, "Note au chemin trop long", 1),
    ],
  };
}

/** La fiche d'un commun, réduite à ce qui porte l'espace — avec la `key` que pose la vraie page. */
function Fiche() {
  const { answerId } = useParams();
  if (!answerId) return null;
  return <CommunDiscussionControl key={answerId} answerId={answerId} communTitle={`Commun ${answerId.slice(-2)}`} scopeEntity={ORGA} />;
}

/** L'adresse, lisible dans le DOM, et les deux flèches du navigateur. */
function Navigateur() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-adresse>{pathname}{search}</output>
      <button type="button" data-nav="retour" onClick={() => { void navigate(-1); }}>retour</button>
      <button type="button" data-nav="suivant" onClick={() => { void navigate(1); }}>suivant</button>
    </>
  );
}

/**
 * `historique` : les adresses visitées, dans l'ordre — on arrive sur la dernière.
 * `deposant` : le lecteur est connecté, et c'est le déposant du commun — le serveur lui annonce
 * qu'il peut créer une discussion, publique ou privée. Par défaut : un visiteur.
 */
function monter(historique: readonly string[] = [AVANT, FICHE], { deposant = false } = {}) {
  // Le serveur, réduit à ce qu'il retient : les discussions créées s'ajoutent à l'espace.
  const creees: Record<string, unknown>[] = [];
  const getDiscussionSpace = vi.fn(async ({ contextId }: { contextId: string }) => {
    const espace = espaceDe(contextId);
    return deposant
      ? { ...espace, canComment: true, creatableAudiences: ["authorAll", "authorAdmin"], threads: [espace.threads[0], ...creees, ...espace.threads.slice(1)] }
      : espace;
  });
  const createDiscussion = vi.fn(async ({ name, audience }: { name: string; audience: string }) => {
    const thread = {
      key: CLE_CREEE, contextType: "forms", contextId: APPEL, path: CHEMIN_CREE, title: name, carrier: null,
      total: 0, unread: 0, last: null, mine: false, virtual: true, kind: "discussion", group: null, audience,
    };
    creees.push(thread);
    return { result: true, thread };
  });
  const cocolight = {
    api: { discussions: { space: getDiscussionSpace, create: createDiscussion } },
    me: deposant ? { isConnected: true } : null,
    entity: deposant ? { userContext: { id: DEPOSANT } } : null,
    helper: {},
  } as unknown as CocolightContextType;
  const rendu = render(
    <MemoryRouter initialEntries={[...historique]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <Routes>
              <Route path="/aac/commun/:answerId" element={<Fiche />} />
              <Route path="*" element={<p data-ailleurs>Une autre page</p>} />
            </Routes>
            <Navigateur />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace, createDiscussion };
}

// Une fois la modale ouverte, Radix retire le reste de la page de l'arbre d'accessibilité : on
// cherche donc le bouton et les flèches par attribut, pas par rôle.
const bouton = () => document.querySelector<HTMLButtonElement>("[data-commun-discussion]")!;
const adresse = () => document.querySelector("[data-adresse]")!.textContent ?? "";
const chemin = () => adresse().split("?")[0];
const param = () => new URLSearchParams(adresse().split("?")[1] ?? "").get("discussion");
const traverser = (sens: "retour" | "suivant") => act(async () => {
  fireEvent.click(document.querySelector(`[data-nav="${sens}"]`)!);
});
const cliquer = (cible: Element) => act(async () => { fireEvent.click(cible); });

const panneau = () => document.querySelector("[data-space-panel]");
const filMonte = () => document.querySelector("[data-comment-thread]");
const rangee = (cle: string) => document.querySelector(`[data-thread-key="${cle}"]`)!;
/** La croix de l'en-tête du fil — celle de la liste n'est à l'écran qu'en une colonne. */
const croix = () => {
  const toutes = screen.getAllByRole("button", { name: "Fermer les discussions" });
  return toutes[toutes.length - 1];
};

/** Ouvre par le bouton, et attend que la modale — chargée en différé — ait rendu sa liste. */
async function ouvrir() {
  await cliquer(bouton());
  await attendreLaListe();
}
async function attendreLaListe(cle = CLE_GENERALE) {
  await screen.findByRole("dialog");
  await waitFor(() => expect(document.querySelector(`[data-thread-key="${cle}"]`)).toBeTruthy());
}

describe("l'espace de discussion d'un commun — le parcours, tous maillons assemblés", () => {
  // La modale arrive en différé, avec tout son graphe (panneau, colonne, dialogue). Ce fichier n'a
  // pas à prouver le différé — `CommunDiscussionControl.chargement.test.tsx` s'en charge — et n'a
  // donc pas à le faire tenir dans la seconde d'attente du premier test qui l'ouvre.
  beforeAll(async () => { await import("@/modules/comment/components/panel/SpaceModal"); });
  beforeEach(() => { fil.montages = 0; });

  describe("un fil choisi fait l'aller-retour par l'adresse", () => {
    it("le bouton ouvre la modale sur le fil général de CE commun, titrée et traduite", async () => {
      monter();
      expect(panneau()).toBeNull();
      await ouvrir();

      expect(panneau()!.getAttribute("data-space-panel")).toBe(CLE_GENERALE);
      expect(param()).toBe(CLE_GENERALE);
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_GENERALE);
      expect(rangee(CLE_GENERALE).getAttribute("data-selected")).toBe("true");
      // Le focus est entré dans la modale, sur le dialogue lui-même — pas sur sa croix.
      expect(document.activeElement).toBe(screen.getByRole("dialog"));
      // Le titre vient de la fiche, pas du serveur ; les libellés sont ceux du module, enregistrés
      // par la modale elle-même puisqu'elle arrive sans l'entrée complète.
      const boite = screen.getByRole("dialog");
      expect(document.getElementById(boite.getAttribute("aria-labelledby")!)!.textContent).toBe("Discussions — Commun c1");
      expect(rangee(CLE_GENERALE).textContent).toContain("Discussion générale");
      // La croix de la modale, posée par le panneau dans ses DEUX en-têtes : celle de la liste est
      // la seule à l'écran en une colonne, celle du fil dès que les deux coexistent.
      expect(screen.getAllByRole("button", { name: "Fermer les discussions" })).toHaveLength(2);
    });

    it("cliquer un fil de la colonne l'écrit dans l'adresse, et c'est LUI qui se monte", async () => {
      monter();
      await ouvrir();
      const premier = filMonte()!.getAttribute("data-montage");

      await cliquer(rangee(CLE_BUDGET));
      expect(param()).toBe(CLE_BUDGET);
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_BUDGET);
      expect(rangee(CLE_BUDGET).getAttribute("data-selected")).toBe("true");
      expect(rangee(CLE_GENERALE).getAttribute("data-selected")).toBe("false");
      // Un autre fil, donc un autre montage : rien de l'ancien ne déteint sur le nouveau.
      expect(filMonte()!.getAttribute("data-montage")).not.toBe(premier);
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Budget");
    });

    it("la même adresse, ouverte comme un lien, rend le même écran sans un clic", async () => {
      monter([AVANT, `${FICHE}?discussion=${encodeURIComponent(CLE_BUDGET)}`]);
      await attendreLaListe(CLE_BUDGET);
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_BUDGET);
      expect(rangee(CLE_BUDGET).getAttribute("data-selected")).toBe("true");
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Budget");
    });

    it("l'espace n'est demandé qu'une fois : le bouton et la modale partagent la réponse", async () => {
      const { getDiscussionSpace } = monter();
      await ouvrir();
      await cliquer(rangee(CLE_BUDGET));
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(getDiscussionSpace).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN });
    });

    it("un fil que l'adresse ne saurait pas relire ne ferme pas la modale", async () => {
      monter();
      await ouvrir();
      await cliquer(rangee(CLE_TROP_LONGUE));
      // Écrit tel quel, le paramètre ne désignerait plus aucun fil : la modale se fermerait sur
      // une adresse que rien ne sait lire. On reste donc où l'on était.
      expect(panneau()).toBeTruthy();
      expect(param()).toBe(CLE_GENERALE);
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_GENERALE);
    });
  });

  describe("fermer défait l'ouverture", () => {
    it("la croix ferme, efface le paramètre et rend le focus au bouton", async () => {
      monter();
      bouton().focus();
      await ouvrir();
      await cliquer(croix());

      expect(panneau()).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(adresse()).toBe(FICHE);
      expect(document.activeElement).toBe(bouton());
    });

    it("… sans faire défiler la page : le bouton est celui qu'on vient de quitter", async () => {
      monter();
      await ouvrir();
      const focus = vi.spyOn(HTMLElement.prototype, "focus");
      await cliquer(croix());
      const rendus = focus.mock.calls.filter((_appel, rang) => focus.mock.contexts[rang] === bouton());
      expect(rendus.length).toBeGreaterThan(0);
      expect(rendus[rendus.length - 1]).toEqual([{ preventScroll: true }]);
      focus.mockRestore();
    });

    it("après la croix, « retour » ramène à la page d'AVANT la fiche — pas à la modale", async () => {
      monter();
      await ouvrir();
      await cliquer(croix());
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
      expect(document.querySelector("[data-ailleurs]")).toBeTruthy();
    });

    it("Échap fait comme la croix — focus rendu au bouton compris", async () => {
      monter();
      bouton().focus();
      await ouvrir();
      expect(document.activeElement).not.toBe(bouton());
      await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); });
      expect(panneau()).toBeNull();
      expect(adresse()).toBe(FICHE);
      expect(document.activeElement).toBe(bouton());
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
    });

    it("deux Échap coup sur coup ne font qu'UN « retour » : on reste sur la fiche", async () => {
      monter();
      await ouvrir();
      // Le second part avant que l'adresse du premier ne soit arrivée : un second « retour » quitterait la fiche.
      await act(async () => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      });
      expect(panneau()).toBeNull();
      expect(adresse()).toBe(FICHE);
    });

    it("après avoir changé de fil aussi : un seul « retour » de trop n'existe pas", async () => {
      monter();
      await ouvrir();
      await cliquer(rangee(CLE_BUDGET));
      await cliquer(rangee(CLE_TITRE));
      await cliquer(croix());
      expect(adresse()).toBe(FICHE);
      // Changer de fil REMPLACE l'entrée : l'ouverture n'en a empilé qu'une, la croix l'a défaite.
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
    });

    it("revenue à la liste des fils puis fermée, elle ne laisse aucune entrée morte", async () => {
      monter();
      await ouvrir();
      await cliquer(screen.getByRole("button", { name: "Retour aux fils" }));
      // Sur la liste : l'adresse ne désigne plus de fil, la modale est toujours là.
      expect(param()).toBeNull();
      expect(panneau()!.getAttribute("data-step")).toBe("threads");
      expect(filMonte()).toBeNull();

      await cliquer(croix());
      expect(panneau()).toBeNull();
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
    });

    it("deux touchers sur le bouton n'ouvrent qu'une fois", async () => {
      monter();
      // Dans le même souffle : le second part avant que l'adresse du premier ne soit arrivée.
      await act(async () => { fireEvent.click(bouton()); fireEvent.click(bouton()); });
      await attendreLaListe();
      await cliquer(croix());
      expect(adresse()).toBe(FICHE);
      // Une entrée jumelle aurait rouvert la modale ici.
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
    });
  });

  describe("les flèches du navigateur", () => {
    it("« retour » ferme la modale sans quitter la fiche ; « suivant » la rouvre sur le fil où l'on était", async () => {
      monter();
      await ouvrir();
      await cliquer(rangee(CLE_BUDGET));

      await traverser("retour");
      expect(adresse()).toBe(FICHE);
      expect(panneau()).toBeNull();
      // Fermée par « retour », elle rend le focus au bouton, comme par la croix ou par Échap.
      expect(document.activeElement).toBe(bouton());

      await traverser("suivant");
      await attendreLaListe(CLE_BUDGET);
      expect(param()).toBe(CLE_BUDGET);
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_BUDGET);
    });

    it("« suivant » rouvre aussi la modale laissée sur la LISTE — ce que l'adresse seule ne dit pas", async () => {
      monter();
      await ouvrir();
      await cliquer(screen.getByRole("button", { name: "Retour aux fils" }));
      await traverser("retour");
      expect(panneau()).toBeNull();

      await traverser("suivant");
      await screen.findByRole("dialog");
      expect(param()).toBeNull();
      expect(panneau()!.getAttribute("data-step")).toBe("threads");
    });
  });

  describe("arrivé par un lien", () => {
    it("la croix REMPLACE l'adresse : il n'y a pas d'ouverture à défaire, et « retour » ne rouvre rien", async () => {
      monter([AVANT, `${FICHE}?discussion=${encodeURIComponent(CLE_BUDGET)}`]);
      await attendreLaListe(CLE_BUDGET);
      await cliquer(croix());
      expect(panneau()).toBeNull();
      expect(adresse()).toBe(FICHE);

      await traverser("retour");
      expect(chemin()).toBe(AVANT);
      // Et « suivant » revient à la fiche, fermée : l'adresse du lien n'est plus dans l'historique.
      await traverser("suivant");
      expect(adresse()).toBe(FICHE);
      expect(panneau()).toBeNull();
    });

    it("le lien du fil d'un AUTRE commun n'ouvre pas cette fiche — et l'ouvrir puis la fermer le laisse intact", async () => {
      const ailleurs = `answers:${AUTRE_COMMUN}`;
      monter([AVANT, `${FICHE}?discussion=${ailleurs}`]);
      // La fiche a reçu son compteur : si l'adresse devait ouvrir la modale, elle le serait déjà.
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(param()).toBe(ailleurs);

      // Le bouton ouvre SON espace, par une entrée de plus ; la croix la défait, et l'adresse de
      // l'autre discussion est là où on l'avait laissée.
      await ouvrir();
      expect(param()).toBe(CLE_GENERALE);
      await cliquer(croix());
      expect(panneau()).toBeNull();
      expect(param()).toBe(ailleurs);
    });
  });

  describe("créer une discussion", () => {
    const plus = () => document.querySelector<HTMLButtonElement>("[data-new-discussion-open]");

    it("un visiteur n'a pas de « + » : le serveur ne lui annonce aucune audience", async () => {
      monter();
      await ouvrir();
      expect(plus()).toBeNull();
    });

    it("le déposant en crée une : elle s'ouvre aussitôt, son adresse est écrite, et fermer défait toujours l'ouverture", async () => {
      const { createDiscussion } = monter([AVANT, FICHE], { deposant: true });
      await ouvrir();
      await cliquer(plus()!);
      fireEvent.change(screen.getByLabelText("Nom de la discussion"), { target: { value: "  Budget   2026 " } });
      await act(async () => { fireEvent.submit(document.querySelector("[data-new-discussion]")!); });

      await waitFor(() => expect(param()).toBe(CLE_CREEE));
      expect(createDiscussion).toHaveBeenCalledTimes(1);
      expect(createDiscussion).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN, name: "Budget 2026", audience: "authorAdmin" });
      // Le fil créé est monté — pas « introuvable » —, titré, et le formulaire a rendu la place.
      expect(filMonte()!.getAttribute("data-target")).toBe(CLE_CREEE);
      expect(document.querySelector("[data-thread-hidden]")).toBeNull();
      expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Budget 2026");
      expect(document.querySelector("[data-new-discussion]")).toBeNull();
      // Relue, la liste la porte : étiquetée par son audience, prête à recevoir son premier message.
      await waitFor(() => expect(rangee(CLE_CREEE)).toBeTruthy());
      expect(rangee(CLE_CREEE).textContent).toContain("Privée");

      // Créer, c'est changer de fil : l'entrée de l'ouverture est REMPLACÉE, et la croix la défait.
      await cliquer(croix());
      expect(adresse()).toBe(FICHE);
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
    });

    it("Échap dans le formulaire le referme, sans fermer la modale", async () => {
      monter([AVANT, FICHE], { deposant: true });
      await ouvrir();
      await cliquer(plus()!);
      const champ = screen.getByLabelText("Nom de la discussion");
      await act(async () => { fireEvent.keyDown(champ, { key: "Escape" }); });
      expect(document.querySelector("[data-new-discussion]")).toBeNull();
      expect(panneau()).toBeTruthy();
      expect(param()).toBe(CLE_GENERALE);
      expect(document.activeElement).toBe(plus());
    });
  });

  describe("d'un commun à l'autre", () => {
    it("la modale du précédent ne suit pas, et chaque fiche demande SON espace", async () => {
      const { getDiscussionSpace } = monter([fiche(AUTRE_COMMUN), `${FICHE}?discussion=${CLE_GENERALE}`]);
      await attendreLaListe();
      expect(panneau()!.getAttribute("data-space-panel")).toBe(CLE_GENERALE);

      await traverser("retour");
      expect(chemin()).toBe(fiche(AUTRE_COMMUN));
      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(getDiscussionSpace).toHaveBeenCalledWith({ contextType: "answers", contextId: AUTRE_COMMUN }));
      // On arrive sur une autre fiche : le focus n'a pas à sauter sur son bouton « Discussion »,
      // comme il le fait quand on referme la modale de la fiche où l'on est.
      expect(document.activeElement).not.toBe(bouton());
    });
  });
});
