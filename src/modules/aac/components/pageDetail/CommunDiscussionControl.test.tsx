// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import cocolightApiClient, { type EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Le bouton « Discussion » de la fiche d'un commun (parité du bouton « Commentaires » de
 * `campDetail.php`) et la modale qu'il ouvre.
 *
 * L'appel au serveur est la frontière ; le lanceur, la requête du compteur et l'adresse sont les
 * VRAIS. La modale a ses propres tests : elle est remplacée ici.
 *
 * À côté de ce fichier :
 *   - `….chargement.test.tsx` — son code n'arrive ni avec la fiche ni avec le compteur ;
 *   - `….attente.test.tsx` — ce que fait le bouton tant que ce code se télécharge ;
 *   - `….parcours.test.tsx` — le bouton assemblé à la VRAIE modale, l'adresse et l'historique.
 */

const modale = vi.hoisted(() => ({ prechauffages: 0, recu: null as Record<string, unknown> | null }));

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
vi.mock("@/modules/comment/components/panel/SpaceModal", () => ({
  default: (props: { onOpenChange: (open: boolean) => void; onSelect: (target: unknown) => void } & Record<string, unknown>) => {
    modale.recu = props;
    return (
      <div data-testid="space-modal">
        <button type="button" onClick={() => props.onOpenChange(false)}>fermer-simulé</button>
        <button type="button" onClick={() => props.onSelect(null)}>liste-simulée</button>
      </div>
    );
  },
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const AUTRE_COMMUN = "65c3000000000000000000c2";
const APPEL = "65c3000000000000000000f1";
const FICHE = `/aac/commun/${COMMUN}`;
const UTILISATEUR = "65d4000000000000000000d1";
const ORGA = { id: "orga-de-l-appel" } as unknown as EntityTypes;

/**
 * Un espace à deux fils, dont on règle les compteurs — dans la forme que le serveur rend : quinze
 * champs par fil, et « peut écrire » pour une session seulement.
 */
function espace(total: number, unread: number, session: boolean) {
  return {
    result: true,
    space: { type: "answers", id: COMMUN, title: "Titre du serveur", formId: APPEL },
    canComment: session,
    truncated: false,
    threads: [
      { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total, unread, last: total === 0 ? null : 1_758_000_000, mine: false, title: null, carrier: null, virtual: total === 0, kind: "general", group: null, audience: null, line: null },
      { key: `forms:${APPEL}:q`, contextType: "forms", contextId: APPEL, path: "q", total: 0, unread: 0, last: null, mine: false, title: "Une question", carrier: null, virtual: true, kind: "question", group: "Proposition", audience: null, line: null },
    ],
  };
}

/**
 * Un refus tel que la façade du SDK le REND : une EXCEPTION, le corps du serveur rangé dans
 * `responseData` — jamais ce corps en valeur de retour.
 */
const refusDuSdk = (code: string) => async (): Promise<never> => {
  throw new cocolightApiClient.error.ApiResponseError("Texte du serveur.", 200, { result: false, code, msg: "Texte du serveur." });
};

/** L'adresse rendue dans le DOM : le seul moyen d'affirmer ce que le bouton y écrit. */
function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

interface Montage {
  readonly url?: string;
  readonly total?: number;
  readonly unread?: number;
  /**
   * Qui est connecté au montage. Par défaut : un visiteur — sauf si l'on demande des non-lus, que
   * le serveur ne compte que pour une session.
   */
  readonly utilisateur?: string | null;
  /** Ce que le serveur répond. Par défaut : l'espace, avec les compteurs demandés. */
  readonly reponse?: () => Promise<unknown>;
}

function monter({ url = FICHE, total = 0, unread = 0, utilisateur = unread > 0 ? UTILISATEUR : null, reponse }: Montage = {}) {
  const getDiscussionSpace = vi.fn(reponse ?? (async () => espace(total, unread, utilisateur !== null)));
  const entity = utilisateur ? { userContext: { id: utilisateur } } : null;
  const cocolight = { api: { getDiscussionSpace }, me: null, entity, helper: {} } as unknown as CocolightContextType;
  const client = new QueryClient();
  const rendu = render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={client}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Une instance peertube" scopeEntity={ORGA} />
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace, client };
}

const bouton = () => screen.getByRole("button", { name: /Discussion/ });
const param = (c: HTMLElement) => new URLSearchParams(c.querySelector("[data-url]")!.textContent ?? "").get("discussion");
/** Laisse la requête du compteur répondre. */
const servir = () => act(async () => { await Promise.resolve(); });
/** L'état de chaque entrée de cache — celle du lecteur, et celle, jamais demandée, du rendu d'attente. */
const etats = (client: QueryClient) => client.getQueryCache().getAll().map(requete => requete.state.status);
/**
 * Attend que la fiche soit AU REPOS : sa demande partie, répondue, et tout ce qui en découle rendu
 * — une modale chargée en différé comprise. C'est ce qui rend probante une affirmation d'ABSENCE :
 * « demande partie » est vrai dès le montage, bien avant qu'il y ait quoi que ce soit à voir.
 */
async function auRepos({ getDiscussionSpace, client }: { getDiscussionSpace: ReturnType<typeof vi.fn>; client: QueryClient }) {
  await waitFor(() => {
    expect(getDiscussionSpace).toHaveBeenCalled();
    expect(client.isFetching()).toBe(0);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

describe("CommunDiscussionControl", () => {
  beforeEach(() => { modale.recu = null; modale.prechauffages = 0; });

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

    it("ne SONDE pas : une fiche laissée ouverte dans un onglet ne redemande rien à intervalle", async () => {
      // Le sondage seulement : revenir sur l'onglet relit, comme partout dans l'application, ce qui
      // a plus de trente secondes.
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
      const fiche = monter();
      await auRepos(fiche);
      expect(fiche.client.getQueriesData({})).toHaveLength(1);
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
      // Une panne n'est dite qu'après ses nouvelles tentatives (1 s, puis 2 s) : c'est CET état
      // qu'on attend, pas le chargement qui le précède.
      vi.useFakeTimers();
      let fiche: ReturnType<typeof monter>;
      try {
        fiche = monter({ reponse: async () => { throw new Error("Network Error"); } });
        await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      } finally {
        vi.useRealTimers();
      }
      expect(fiche.getDiscussionSpace).toHaveBeenCalledTimes(3);
      expect(etats(fiche.client)).toContain("error");
      expect(bouton().textContent).toBe("Discussion");
      expect(bouton().hasAttribute("disabled")).toBe(false);

      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
    });

    it("reste là aussi quand le serveur REFUSE l'espace — sans compteur, et toujours cliquable", async () => {
      // Un refus arrive aussitôt, sans nouvelle tentative : la modale dira pourquoi.
      const fiche = monter({ reponse: refusDuSdk("hidden") });
      await auRepos(fiche);
      expect(fiche.getDiscussionSpace).toHaveBeenCalledTimes(1);
      expect(etats(fiche.client)).toContain("error");
      expect(bouton().textContent).toBe("Discussion");
      expect(bouton().hasAttribute("disabled")).toBe(false);

      fireEvent.click(bouton());
      await screen.findByTestId("space-modal");
    });

    it("un espace que le serveur ne montre plus perd ses compteurs — une panne, elle, les lui laisse", async () => {
      const fiche = monter({ total: 12, unread: 3 });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total] [aria-hidden]")!.textContent).toBe("12"));

      // Une relecture en panne : le dernier compte servi reste affiché.
      vi.useFakeTimers();
      try {
        fiche.getDiscussionSpace.mockRejectedValue(new Error("Network Error"));
        await act(async () => {
          void fiche.client.invalidateQueries();
          await vi.advanceTimersByTimeAsync(10_000);
        });
      } finally {
        vi.useRealTimers();
      }
      expect(etats(fiche.client)).toContain("error");
      expect(document.querySelector("[data-commun-discussion-total] [aria-hidden]")!.textContent).toBe("12");
      expect(document.querySelector("[data-commun-discussion-unread]")).toBeTruthy();

      // Un refus : le serveur a répondu, et il ne montre plus cet espace.
      fiche.getDiscussionSpace.mockImplementation(refusDuSdk("hidden"));
      await act(async () => { await fiche.client.invalidateQueries(); });
      await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeNull());
      expect(document.querySelector("[data-commun-discussion-unread]")).toBeNull();
      expect(bouton().textContent).toBe("Discussion");
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
      const fiche = monter({ url: `${FICHE}?discussion=answers:${AUTRE_COMMUN}` });
      await auRepos(fiche);
      expect(screen.queryByTestId("space-modal")).toBeNull();
      expect(bouton().hasAttribute("aria-busy")).toBe(false);
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
