// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Le bouton « Discuter » d'un palier (parité de l'action « Commenter » que porte chaque carte de la
 * liste des dépenses du legacy) : il ouvre l'espace de discussion du commun sur le fil de SA ligne.
 *
 * Il est monté ici À CÔTÉ du bouton de la fiche, comme sur la page : c'est celui-ci qui monte la
 * modale. L'appel au serveur est la frontière ; le lanceur, la requête, la lecture de la réponse et
 * l'adresse sont les VRAIS. La modale a ses propres tests : elle est remplacée.
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
  default: (props: { onOpenChange: (open: boolean) => void } & Record<string, unknown>) => {
    modale.recu = props;
    return (
      <div data-testid="space-modal">
        <button type="button" onClick={() => props.onOpenChange(false)}>fermer-simulé</button>
      </div>
    );
  },
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");
const { CommunMilestoneDiscussionButton } = await import("./CommunMilestoneDiscussionButton");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const DEPOT = "65c3000000000000000000e1";
const FINANCEMENT = "65c3000000000000000000e3";
const FICHE = `/aac/commun/${COMMUN}`;
const UTILISATEUR = "65d4000000000000000000d1";

/** Le chemin du fil d'une ligne, tel que le legacy l'écrit : l'étape et la liste d'où l'on a cliqué, puis la ligne. */
const chemin = (etape: string, liste: string, ligne: string) =>
  `${APPEL}.${etape}.${COMMUN}.${liste}.question_${liste}.comment.financement.depensekey.aapStep1-depense.depenseindex.${ligne}`;
const cle = (path: string) => `forms:${APPEL}:${path}`;

function fil(path: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: cle(path), contextType: "forms", contextId: APPEL, path, title: null, carrier: null, total: 0, unread: 0,
    last: null, mine: false, virtual: false, kind: "expense", group: "Financement", audience: null, line: null, ...over,
  };
}

const LIGNE_0 = chemin(DEPOT, "depense", "0");            // commentée, depuis la liste du dépôt
const LIGNE_2 = chemin(FINANCEMENT, "financer", "2");     // personne n'y a écrit : proposée par le serveur
const LIGNE_5_DEPOT = chemin(DEPOT, "depense", "5");      // commentée sur les DEUX listes
const LIGNE_5_FINANCEMENT = chemin(FINANCEMENT, "financer", "5");

/** L'espace d'un commun à paliers, tel que le serveur le rend. */
function espace(session: boolean, over: Record<string, unknown>[] = []) {
  return {
    result: true,
    space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
    canComment: session,
    truncated: false,
    threads: [
      { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, title: null, carrier: null, total: 4, unread: 0, last: 1_758_000_000, mine: false, virtual: false, kind: "general", group: null, audience: null, line: null },
      fil(LIGNE_0, { title: "Local", total: 2, unread: session ? 1 : 0, last: 1_758_000_100, line: "0" }),
      fil(LIGNE_2, { title: "Matériel", virtual: true, line: "2" }),
      fil(LIGNE_5_DEPOT, { title: "Salaires", total: 3, last: 1_758_000_200, line: "5" }),
      fil(LIGNE_5_FINANCEMENT, { title: "Salaires", total: 1, unread: session ? 1 : 0, last: 1_758_000_300, line: "5" }),
      ...over,
    ],
  };
}

function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

/** Les paliers de la fiche, que l'on peut retirer un à un — comme un palier supprimé pendant qu'on discute. */
function Paliers({ lignes }: { lignes: readonly (readonly [string, string | null])[] }) {
  const [montrees, setMontrees] = useState(lignes);
  return (
    <>
      {montrees.map(([ligne, nom]) => <CommunMilestoneDiscussionButton key={ligne} answerId={COMMUN} lineKey={ligne} name={nom} />)}
      <button type="button" onClick={() => setMontrees([])}>retirer-les-paliers</button>
    </>
  );
}

interface Montage {
  readonly url?: string;
  readonly session?: boolean;
  readonly lignes?: readonly (readonly [string, string | null])[];
  readonly fils?: Record<string, unknown>[];
  readonly reponse?: () => Promise<unknown>;
}

const TOUTES = [["0", "Local"], ["2", "Matériel"], ["5", "Salaires"], ["9", "Sans fil"]] as const;

function monter({ url = FICHE, session = true, lignes = TOUTES, fils = [], reponse }: Montage = {}) {
  const getDiscussionSpace = vi.fn(reponse ?? (async () => espace(session, fils)));
  const entity = session ? { userContext: { id: UTILISATEUR } } : null;
  const cocolight = { api: { getDiscussionSpace }, me: null, entity, helper: {} } as unknown as CocolightContextType;
  const client = new QueryClient();
  const rendu = render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={client}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Un commun" />
            <Paliers lignes={lignes} />
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace, client };
}

const palier = (ligne: string) => document.querySelector<HTMLButtonElement>(`[data-milestone-discussion="${ligne}"]`);
const boutonDeLaFiche = () => document.querySelector<HTMLButtonElement>("[data-commun-discussion]")!;
const param = (c: HTMLElement) => new URLSearchParams(c.querySelector("[data-url]")!.textContent ?? "").get("discussion");
/** Attend que la liste de l'espace soit servie et rendue : c'est ce qui rend probante une ABSENCE de bouton. */
async function servi({ getDiscussionSpace, client }: { getDiscussionSpace: ReturnType<typeof vi.fn>; client: QueryClient }) {
  await waitFor(() => {
    expect(getDiscussionSpace).toHaveBeenCalled();
    expect(client.isFetching()).toBe(0);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

describe("CommunMilestoneDiscussionButton", () => {
  beforeEach(() => { modale.recu = null; modale.prechauffages = 0; });

  describe("quand il s'affiche", () => {
    it("pas avant que l'espace ait répondu : il ne promet pas un fil qu'il ne connaît pas", async () => {
      let repondre: (corps: unknown) => void = () => {};
      const banc = monter({ reponse: () => new Promise(resolve => { repondre = resolve; }) });
      await waitFor(() => expect(banc.getDiscussionSpace).toHaveBeenCalled());
      expect(document.querySelectorAll("[data-milestone-discussion]")).toHaveLength(0);
      await act(async () => { repondre(espace(true)); });
      await waitFor(() => expect(palier("0")).not.toBeNull());
    });

    it("connecté : sur chaque palier dont l'espace propose un fil — écrit, ou à lancer", async () => {
      await servi(monter());
      expect(palier("0")).not.toBeNull();
      expect(palier("2")).not.toBeNull();
      expect(palier("5")).not.toBeNull();
    });

    it("jamais sur un palier pour lequel l'espace ne propose aucun fil", async () => {
      await servi(monter());
      expect(palier("9")).toBeNull();
    });

    it("visiteur : seulement là où il y a quelque chose à lire — il n'a rien à démarrer", async () => {
      await servi(monter({ session: false }));
      expect(palier("0")).not.toBeNull();
      expect(palier("5")).not.toBeNull();
      expect(palier("2")).toBeNull();
    });

    it("reste absent quand le serveur ne sert pas l'espace — le bouton de la fiche, lui, demeure", async () => {
      // Un REFUS : il n'est pas retenté, la requête est en erreur dès la réponse. C'est cet état
      // qu'on regarde — pas le chargement, où l'absence de bouton ne prouverait rien.
      const banc = monter({ reponse: async () => ({ result: false, code: "hidden" }) });
      await servi(banc);
      const etats = banc.client.getQueryCache().getAll().map(requete => requete.state.status);
      expect(etats.filter(etat => etat === "error")).toHaveLength(1);
      expect(etats).not.toContain("success");
      expect(document.querySelectorAll("[data-milestone-discussion]")).toHaveLength(0);
      expect(boutonDeLaFiche()).not.toBeNull();
    });

    it("tous les paliers lisent la même liste : UNE demande, bouton de la fiche compris", async () => {
      const banc = monter();
      await servi(banc);
      expect(banc.getDiscussionSpace).toHaveBeenCalledTimes(1);
    });

    it("ne SONDE pas : une fiche laissée ouverte ne redemande rien à intervalle, quel que soit le nombre de paliers", async () => {
      vi.useFakeTimers();
      try {
        const { getDiscussionSpace } = monter();
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(palier("0")).not.toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
        expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("ce qu'il dit", () => {
    it("se nomme par le palier, en commençant par ce qu'on lit à l'écran", async () => {
      await servi(monter());
      expect(palier("2")!.getAttribute("aria-label")).toBe("Discuter du palier « Matériel »");
      expect(palier("2")!.textContent).toBe("Discuter");
      expect(palier("2")!.getAttribute("title")).toBe(palier("2")!.getAttribute("aria-label"));
    });

    it("sans nom de palier — absent, ou fait d'espaces —, le dit autrement plutôt que de citer du vide", async () => {
      await servi(monter({ lignes: [["0", null], ["2", "   "]] }));
      expect(palier("0")!.getAttribute("aria-label")).toMatch(/^Discuter de ce palier, /);
      expect(palier("2")!.getAttribute("aria-label")).toBe("Discuter de ce palier");
    });

    it("compte les messages et les non-lus de la ligne — le chiffre à l'œil, la phrase au lecteur d'écran", async () => {
      await servi(monter());
      expect(palier("0")!.getAttribute("aria-label")).toBe("Discuter du palier « Local », 2 messages, 1 non lu");
      expect(palier("0")!.querySelector("[data-milestone-discussion-total]")!.textContent).toBe("2");
      expect(palier("0")!.querySelector("[data-milestone-discussion-unread]")!.textContent).toBe("1");
    });

    it("une ligne commentée sur les deux listes du legacy : ses compteurs s'additionnent", async () => {
      await servi(monter());
      expect(palier("5")!.getAttribute("aria-label")).toBe("Discuter du palier « Salaires », 4 messages, 1 non lu");
    });

    it("ne montre ni compteur ni pastille tant que personne n'a écrit", async () => {
      await servi(monter());
      expect(palier("2")!.querySelector("[data-milestone-discussion-total]")).toBeNull();
      expect(palier("2")!.querySelector("[data-milestone-discussion-unread]")).toBeNull();
    });

    it("sans non-lu, pas de pastille — et la phrase n'en parle pas", async () => {
      await servi(monter({ session: false }));
      expect(palier("0")!.querySelector("[data-milestone-discussion-unread]")).toBeNull();
      expect(palier("0")!.getAttribute("aria-label")).toBe("Discuter du palier « Local », 2 messages");
    });

    it("accorde au singulier, et plafonne la pastille à l'œil — pas le nombre qu'on lit", async () => {
      await servi(monter({
        lignes: [["7", "Un"], ["8", "Beaucoup"], ["10", "Juste dessous"], ["11", "Juste dessus"]],
        fils: [
          fil(chemin(FINANCEMENT, "financer", "7"), { total: 1, last: 1, line: "7" }),
          fil(chemin(FINANCEMENT, "financer", "8"), { total: 250, unread: 120, last: 1, line: "8" }),
          fil(chemin(FINANCEMENT, "financer", "10"), { total: 150, unread: 99, last: 1, line: "10" }),
          fil(chemin(FINANCEMENT, "financer", "11"), { total: 150, unread: 100, last: 1, line: "11" }),
        ],
      }));
      expect(palier("7")!.getAttribute("aria-label")).toBe("Discuter du palier « Un », 1 message");
      expect(palier("8")!.getAttribute("aria-label")).toBe("Discuter du palier « Beaucoup », 250 messages, 120 non lus");
      expect(palier("8")!.querySelector("[data-milestone-discussion-unread]")!.textContent).toBe("99+");
      expect(palier("10")!.querySelector("[data-milestone-discussion-unread]")!.textContent).toBe("99");
      expect(palier("11")!.querySelector("[data-milestone-discussion-unread]")!.textContent).toBe("99+");
    });

    it("le mot « Discuter » ne s'affiche qu'à partir de 80 rem : en deçà, l'icône et le compteur laissent sa place au nom du palier", async () => {
      await servi(monter());
      const mot = [...palier("2")!.querySelectorAll("span")].find(span => span.textContent === "Discuter")!;
      const classes = mot.className.split(/\s+/);
      expect(classes).toContain("hidden");
      expect(classes).toContain("xl:inline");
      expect(classes).not.toContain("sm:inline");
      // … et le nom accessible, lui, le dit à toutes les largeurs.
      expect(palier("2")!.getAttribute("aria-label")).toMatch(/^Discuter du palier/);
    });

    it("sa marge est celle d'un bouton à icône, posée là où la taille `sm` la lit", async () => {
      await servi(monter());
      const classes = palier("2")!.className.split(/\s+/);
      expect(classes).toContain("has-[>svg]:px-2");
      expect(classes).not.toContain("has-[>svg]:px-2.5");
    });

    it("annonce qu'il ouvre un dialogue, et se nomme pour qu'on lui rende le focus", async () => {
      await servi(monter());
      expect(palier("2")!.getAttribute("aria-haspopup")).toBe("dialog");
      expect(palier("2")!.getAttribute("data-discussion-opener")).toBe("palier:2");
      expect(palier("0")!.getAttribute("data-discussion-opener")).toBe("palier:0");
    });
  });

  describe("ce qu'il ouvre", () => {
    it("la modale de la fiche, sur le fil de SA ligne, écrit dans l'adresse", async () => {
      const banc = monter();
      await servi(banc);
      fireEvent.click(palier("0")!);
      await screen.findByTestId("space-modal");
      expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: LIGNE_0 });
      expect(param(banc.container)).toBe(cle(LIGNE_0));
    });

    it("une ligne où personne n'a écrit : sur le fil que le serveur propose de lancer", async () => {
      const banc = monter();
      await servi(banc);
      fireEvent.click(palier("2")!);
      await screen.findByTestId("space-modal");
      expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: LIGNE_2 });
    });

    it("une ligne commentée sur les deux listes : sur le fil où l'on a écrit en dernier", async () => {
      const banc = monter();
      await servi(banc);
      fireEvent.click(palier("5")!);
      await screen.findByTestId("space-modal");
      expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: LIGNE_5_FINANCEMENT });
    });

    it("une seule modale pour toute la fiche, quel que soit le palier d'où l'on vient", async () => {
      const banc = monter();
      await servi(banc);
      fireEvent.click(palier("0")!);
      await screen.findByTestId("space-modal");
      expect(screen.getAllByTestId("space-modal")).toHaveLength(1);
    });

    it("le survol et le focus préchauffent le code de la modale, comme sur le bouton de la fiche", async () => {
      await servi(monter());
      expect(modale.prechauffages).toBe(0);
      fireEvent.mouseEnter(palier("2")!);
      expect(modale.prechauffages).toBe(1);
      fireEvent.focus(palier("0")!);
      expect(modale.prechauffages).toBe(2);
    });
  });

  /**
   * La modale n'a pas de `DialogTrigger` : c'est le bouton de la fiche qui rend le focus à la
   * fermeture. Ouverte d'un palier, c'est à CE palier qu'il doit revenir — sinon qui navigue au
   * clavier perd sa place dans la liste.
   */
  describe("le focus", () => {
    it("revient au palier d'où l'on a ouvert, pas au bouton de la fiche", async () => {
      await servi(monter());
      palier("2")!.focus();
      fireEvent.click(palier("2")!);
      await screen.findByTestId("space-modal");
      screen.getByText("fermer-simulé").focus();

      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(palier("2"));
    });

    it("… au bon palier quand il y en a plusieurs", async () => {
      await servi(monter());
      fireEvent.click(palier("5")!);
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(palier("5"));
    });

    it("ouverte par le bouton de la fiche, c'est à lui qu'il revient — un palier ne le prend pas", async () => {
      await servi(monter());
      fireEvent.click(boutonDeLaFiche());
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(boutonDeLaFiche());
    });

    it("le palier a disparu entre-temps : le focus revient au bouton de la fiche, jamais nulle part", async () => {
      await servi(monter());
      fireEvent.click(palier("2")!);
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("retirer-les-paliers"));
      expect(palier("2")).toBeNull();

      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(boutonDeLaFiche());
    });

    it("une seconde ouverture, par un autre bouton, oublie le premier", async () => {
      await servi(monter());
      fireEvent.click(palier("2")!);
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(palier("2"));

      fireEvent.click(boutonDeLaFiche());
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(boutonDeLaFiche());
    });
  });
});
