// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
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

/** `historique` : les adresses visitées, dans l'ordre — on arrive sur la dernière. */
function monter(historique: readonly string[] = [AVANT, FICHE]) {
  const getDiscussionSpace = vi.fn(async ({ contextId }: { contextId: string }) => espaceDe(contextId));
  const cocolight = { api: { getDiscussionSpace }, me: null, entity: null, helper: {} } as unknown as CocolightContextType;
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
  return { ...rendu, getDiscussionSpace };
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

    it("après la croix, « retour » ramène à la page d'AVANT la fiche — pas à la modale", async () => {
      monter();
      await ouvrir();
      await cliquer(croix());
      await traverser("retour");
      expect(chemin()).toBe(AVANT);
      expect(document.querySelector("[data-ailleurs]")).toBeTruthy();
    });

    it("Échap fait comme la croix", async () => {
      monter();
      await ouvrir();
      await act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }); });
      expect(panneau()).toBeNull();
      expect(adresse()).toBe(FICHE);
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

    it("le lien du fil d'un AUTRE commun n'ouvre pas cette fiche, et le bouton n'y touche pas", async () => {
      const ailleurs = `answers:${AUTRE_COMMUN}`;
      const { getDiscussionSpace } = monter([AVANT, `${FICHE}?discussion=${ailleurs}`]);
      await waitFor(() => expect(getDiscussionSpace).toHaveBeenCalled());
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(param()).toBe(ailleurs);
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
