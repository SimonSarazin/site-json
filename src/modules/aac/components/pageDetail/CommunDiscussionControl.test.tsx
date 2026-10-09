// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Le bouton « Discussion » de la fiche d'un commun (parité du bouton « Commentaires » de
 * `campDetail.php`) et la modale qu'il ouvre.
 *
 * L'appel au serveur est la frontière ; le lanceur, la requête du compteur et l'adresse sont les
 * VRAIS. La modale a ses propres tests : elle est remplacée, et c'est voulu — ce remplacement est
 * aussi ce qui prouve qu'elle n'est pas CHARGÉE avec la fiche, mais quand on vise le bouton ou
 * qu'on l'ouvre (`chargements`).
 *
 * Le bouton assemblé à la VRAIE modale — un fil choisi qui fait l'aller-retour par l'adresse,
 * la croix et Échap dans l'historique — est dans `CommunDiscussionControl.parcours.test.tsx`.
 */

const modale = vi.hoisted(() => ({ chargements: 0, prechauffages: 0, recu: null as Record<string, unknown> | null }));

// Le VRAI `lazy` de `vite-preload`, dont on compte seulement les appels à `preload()`.
vi.mock("vite-preload", async importOriginal => {
  const reel = await importOriginal<typeof import("vite-preload")>();
  const lazy: typeof reel.lazy = factory => {
    const composant = reel.lazy(factory);
    const prechauffer = composant.preload;
    composant.preload = () => { modale.prechauffages += 1; return prechauffer(); };
    return composant;
  };
  return { ...reel, lazy };
});

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/panel/SpaceModal", () => {
  // La modale et tout ce qu'elle tire : le fil, le composer, le rendu markdown. La fabrique ne
  // s'exécute qu'au premier import — un import statique dans le bouton la déclencherait dès le
  // chargement de la fiche.
  modale.chargements += 1;
  return {
    default: (props: { onOpenChange: (open: boolean) => void; onSelect: (target: unknown) => void } & Record<string, unknown>) => {
      modale.recu = props;
      return (
        <div data-testid="space-modal">
          <button type="button" onClick={() => props.onOpenChange(false)}>fermer-simulé</button>
          <button type="button" onClick={() => props.onSelect(null)}>liste-simulée</button>
        </div>
      );
    },
  };
});

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const AUTRE_COMMUN = "65c3000000000000000000c2";
const APPEL = "65c3000000000000000000f1";
const FICHE = `/aac/commun/${COMMUN}`;
const ORGA = { id: "orga-de-l-appel" } as unknown as EntityTypes;

/** Un espace à deux fils, dont on règle les compteurs. */
function espace(total: number, unread: number) {
  return {
    result: true,
    space: { type: "answers", id: COMMUN, title: "Titre du serveur", formId: APPEL },
    canComment: false,
    truncated: false,
    threads: [
      { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total, unread, last: null, virtual: total === 0, kind: "general" },
      { key: `forms:${APPEL}:q`, contextType: "forms", contextId: APPEL, path: "q", total: 0, unread: 0, last: null, virtual: true, kind: "question" },
    ],
  };
}

/** L'adresse rendue dans le DOM : le seul moyen d'affirmer ce que le bouton y écrit. */
function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

interface Montage {
  readonly url?: string;
  readonly total?: number;
  readonly unread?: number;
  /** Qui est connecté au montage. Par défaut : personne, un visiteur. */
  readonly utilisateur?: string | null;
  /** Ce que le serveur répond. Par défaut : l'espace, avec les compteurs demandés. */
  readonly reponse?: () => Promise<unknown>;
}

function monter({ url = FICHE, total = 0, unread = 0, utilisateur = null, reponse }: Montage = {}) {
  const getDiscussionSpace = vi.fn(reponse ?? (async () => espace(total, unread)));
  const entity = utilisateur ? { userContext: { id: utilisateur } } : null;
  const cocolight = { api: { getDiscussionSpace }, me: null, entity, helper: {} } as unknown as CocolightContextType;
  const rendu = render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Une instance peertube" scopeEntity={ORGA} />
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace };
}

const bouton = () => screen.getByRole("button", { name: /Discussion/ });
const param = (c: HTMLElement) => new URLSearchParams(c.querySelector("[data-url]")!.textContent ?? "").get("discussion");
/** Laisse la requête du compteur répondre. */
const servir = () => act(async () => { await Promise.resolve(); });

describe("CommunDiscussionControl", () => {
  beforeEach(() => { modale.recu = null; modale.prechauffages = 0; });

  /**
   * ⚠️ À garder EN TÊTE du fichier. Un module ne se charge qu'une fois par fichier de test : la
   * preuve « pas chargée avec la fiche » ne vaut qu'avant toute ouverture et tout survol. Elle
   * tient donc en UN test, le premier — les suivants ne lisent plus `chargements`.
   */
  describe("le code de la modale", () => {
    it("n'arrive ni avec la fiche ni avec le compteur : au survol du bouton, et sans la monter", async () => {
      monter({ total: 5 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      // La fiche est affichée, son compteur aussi : le fil n'est pas le prix d'une fiche qu'on lit.
      expect(screen.queryByTestId("space-modal")).toBeNull();
      expect(modale.chargements).toBe(0);

      fireEvent.mouseEnter(bouton());
      expect(modale.prechauffages).toBe(1);
      // Viser le bouton suffit à le faire venir : au clic, la modale n'attend pas.
      await waitFor(() => expect(modale.chargements).toBe(1));
      expect(screen.queryByTestId("space-modal")).toBeNull();
    });
  });

  describe("le bouton", () => {
    it("est là sans session, et se nomme « Discussion »", async () => {
      monter();
      await servir();
      expect(bouton().textContent).toBe("Discussion");
    });

    it("annonce qu'il ouvre un dialogue", async () => {
      monter();
      await servir();
      expect(bouton().getAttribute("aria-haspopup")).toBe("dialog");
    });

    it("demande le compteur de CE commun, une seule fois", async () => {
      const { getDiscussionSpace } = monter({ total: 5 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(getDiscussionSpace).toHaveBeenCalledWith({ contextType: "answers", contextId: COMMUN });
    });

    it("connecté, ne le demande qu'une fois aussi — pas une pour le visiteur, puis une pour lui", async () => {
      const { getDiscussionSpace } = monter({ total: 5, utilisateur: "65d4000000000000000000d1" });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      await servir();
      expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
    });

    it("ne SONDE pas : une fiche laissée ouverte dans un onglet ne redemande rien", async () => {
      vi.useFakeTimers();
      try {
        const { getDiscussionSpace } = monter({ total: 5 });
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
        expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("compte les messages de l'espace — le chiffre à l'œil, la phrase au lecteur d'écran", async () => {
      monter({ total: 5 });
      const compteur = await waitFor(() => {
        const noeud = document.querySelector("[data-commun-discussion-total]");
        expect(noeud).toBeTruthy();
        return noeud!;
      });
      expect(compteur.querySelector("[aria-hidden]")!.textContent).toBe("5");
      expect(compteur.querySelector(".sr-only")!.textContent).toBe("5 messages");
    });

    it("accorde au singulier", async () => {
      monter({ total: 1, unread: 1 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total] .sr-only")!.textContent).toBe("1 message"));
      expect(document.querySelector("[data-commun-discussion-unread] .sr-only")!.textContent).toBe("1 non lu");
    });

    it("ne montre aucun compteur tant que personne n'a écrit", async () => {
      const { getDiscussionSpace } = monter();
      await waitFor(() => expect(getDiscussionSpace).toHaveBeenCalled());
      await servir();
      expect(document.querySelector("[data-commun-discussion-total]")).toBeNull();
      expect(document.querySelector("[data-commun-discussion-unread]")).toBeNull();
    });

    it("ne pose la pastille des non-lus que s'il y en a", async () => {
      monter({ total: 5, unread: 3 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-unread] .sr-only")!.textContent).toBe("3 non lus"));
      expect(document.querySelector("[data-commun-discussion-unread] [aria-hidden]")!.textContent).toBe("3");
    });

    it("plafonne la pastille à l'œil, pas le nombre qu'on lit", async () => {
      monter({ total: 300, unread: 120 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-unread] [aria-hidden]")!.textContent).toBe("99+"));
      expect(document.querySelector("[data-commun-discussion-unread] .sr-only")!.textContent).toBe("120 non lus");
    });

    it.each([[99, "99"], [100, "99+"]])("au plafond — %i non-lus s'écrivent « %s »", async (unread, attendu) => {
      monter({ total: 300, unread });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-unread] [aria-hidden]")!.textContent).toBe(attendu));
    });

    it("reste là, sans compteur, quand le serveur ne répond pas — et ouvre quand même", async () => {
      // Le compteur est un plus : son échec ne doit ni retirer le bouton, ni l'empêcher d'ouvrir.
      const { getDiscussionSpace } = monter({ reponse: async () => { throw new Error("Network Error"); } });
      await waitFor(() => expect(getDiscussionSpace).toHaveBeenCalled());
      await servir();
      expect(bouton().textContent).toBe("Discussion");
      expect(bouton().hasAttribute("disabled")).toBe(false);

      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
    });
  });

  describe("la modale", () => {
    it("fermée, n'est pas montée", async () => {
      monter({ total: 5 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      expect(screen.queryByTestId("space-modal")).toBeNull();
    });

    it("y arriver au clavier préchauffe son code, comme le survol", async () => {
      monter();
      await servir();
      expect(modale.prechauffages).toBe(0);
      fireEvent.focus(bouton());
      expect(modale.prechauffages).toBe(1);
      expect(screen.queryByTestId("space-modal")).toBeNull();
    });

    it("au clic, s'ouvre sur le fil général de CE commun et l'écrit dans l'adresse", async () => {
      const { container } = monter();
      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
      expect(modale.recu).toMatchObject({
        open: true,
        space: { type: "answers", id: COMMUN },
        target: { type: "answers", id: COMMUN, path: null },
        title: "Une instance peertube",
        scopeEntity: ORGA,
      });
      expect(param(container)).toBe(`answers:${COMMUN}`);
    });

    it("une adresse qui désigne un fil de ce commun l'ouvre sans clic", async () => {
      const chemin = `${APPEL}.65c3000000000000000000e1.${COMMUN}.titre.question_titre.comment`;
      monter({ url: `${FICHE}?discussion=forms:${APPEL}:${chemin}` });
      await screen.findByTestId("space-modal");
      expect(modale.recu).toMatchObject({ target: { type: "forms", id: APPEL, path: chemin } });
    });

    it("l'adresse d'un autre commun ne l'ouvre pas", async () => {
      const { getDiscussionSpace } = monter({ url: `${FICHE}?discussion=answers:${AUTRE_COMMUN}` });
      await waitFor(() => expect(getDiscussionSpace).toHaveBeenCalled());
      await servir();
      expect(screen.queryByTestId("space-modal")).toBeNull();
    });

    it("revenir à la liste des fils ne la ferme pas", async () => {
      const { container } = monter();
      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("liste-simulée"));
      expect(screen.getByTestId("space-modal")).toBeTruthy();
      expect(modale.recu).toMatchObject({ target: null });
      expect(param(container)).toBeNull();
    });

    it("la fermer la démonte et rend l'adresse de la fiche — recharger ne la rouvrirait pas", async () => {
      const { container } = monter();
      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(screen.queryByTestId("space-modal")).toBeNull();
      expect(param(container)).toBeNull();
    });
  });

  /**
   * Radix rendrait le focus à son `DialogTrigger`, et la modale n'en a pas : elle s'ouvre aussi par
   * une adresse. Sans ce retour, le focus tombait sur `<body>` (mesuré au navigateur le 07/10).
   */
  describe("le focus", () => {
    it("revient au bouton quand la modale se ferme", async () => {
      monter();
      bouton().focus();
      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
      // Le focus est parti dans la modale, comme le fait Radix à l'ouverture.
      screen.getByText("liste-simulée").focus();
      expect(document.activeElement).not.toBe(bouton());

      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(bouton());
    });

    it("n'est PAS pris au montage : une fiche qui s'affiche ne vole pas le focus", async () => {
      monter({ total: 5 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
      expect(document.activeElement).toBe(document.body);
    });

    it("ne bouge pas tant que la modale reste ouverte, même revenue à la liste", async () => {
      monter();
      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
      const dansLaModale = screen.getByText("liste-simulée");
      dansLaModale.focus();
      fireEvent.click(dansLaModale);
      expect(document.activeElement).toBe(dansLaModale);
    });
  });
});
