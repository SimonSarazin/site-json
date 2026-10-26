// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useContext } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { MilestoneLineSlotContext } from "@/modules/coform/contexts/MilestoneLineSlotContext";
import type { DepenseEntry } from "@/modules/coform/utils/depense";
import "../../i18n";

/**
 * Le bouton « Discuter » des lignes de dépense DANS LE FORMULAIRE d'édition d'un commun — parité de
 * « Commenter » sur la liste des dépenses du formulaire legacy.
 *
 * Monté comme sur la fiche : le bouton de la fiche (qui monte la modale), un palier de la fiche, et
 * le formulaire par-dessus. Le formulaire est un témoin — un vrai `<form>`, qui tient une liste
 * LOCALE et demande à l'emplacement ce qu'il pose sur chaque ligne, comme le fait le champ de
 * dépenses. Le lanceur, la requête, la lecture de l'espace et l'adresse sont les vrais ; l'appel au
 * serveur est la frontière ; la modale a ses propres tests.
 */

const modale = vi.hoisted(() => ({ recu: null as Record<string, unknown> | null }));

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
const { CommunFormLineDiscussions } = await import("./CommunFormLineDiscussions");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const FINANCEMENT = "65c3000000000000000000e3";
const UTILISATEUR = "65d4000000000000000000d1";

const chemin = (ligne: string) =>
  `${APPEL}.${FINANCEMENT}.${COMMUN}.financer.question_financer.comment.financement.depensekey.aapStep1-depense.depenseindex.${ligne}`;
const cle = (ligne: string) => `forms:${APPEL}:${chemin(ligne)}`;
const fil = (ligne: string, over: Record<string, unknown> = {}) => ({
  key: cle(ligne), contextType: "forms", contextId: APPEL, path: chemin(ligne), title: null, carrier: null, total: 0, unread: 0,
  last: null, mine: false, virtual: true, kind: "expense", group: "Financement", audience: null, line: ligne, ...over,
});

/** L'espace : un fil par ligne « 0 », « 1 », « 2 » et « 3 » du document — la « 1 » est commentée. Rien pour une ligne « 9 ». */
const espace = (session: boolean) => ({
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: session,
  truncated: false,
  threads: [fil("0"), fil("1", { virtual: false, total: 2, unread: session ? 1 : 0, last: 1_758_000_100 }), fil("2"), fil("3")],
});

const A: DepenseEntry = { poste: "Local", price: 100, milestone: "m-a" };
const B: DepenseEntry = { poste: "Matériel", price: 200, milestone: "m-b" };
const C: DepenseEntry = { poste: "Salaires", price: 300, milestone: "m-c" };
const NOUVELLE: DepenseEntry = { poste: "Ajoutée", price: 10, milestone: "m-n" };

const soumis = vi.fn();

/** Le formulaire témoin : un vrai `<form>`, une liste locale, et l'emplacement de chaque ligne. */
function Formulaire({ lignes, champ = "depense", reponse = COMMUN }: { lignes: readonly DepenseEntry[]; champ?: string; reponse?: string | null }) {
  const emplacement = useContext(MilestoneLineSlotContext);
  return (
    <form data-testid="formulaire" onSubmit={event => { event.preventDefault(); soumis(); }}>
      {lignes.map((ligne, index) => (
        <div key={index} data-ligne={index}>
          {emplacement?.({ answerId: reponse ?? undefined, fieldName: champ, lines: lignes, index, name: ligne.poste })}
        </div>
      ))}
    </form>
  );
}

function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

interface Montage {
  readonly enregistrees?: unknown;
  readonly lignes?: readonly DepenseEntry[];
  readonly enabled?: boolean;
  readonly champ?: string;
  /** La réponse que le formulaire dit éditer ; `null` : une réponse pas encore enregistrée. */
  readonly reponse?: string | null;
  readonly session?: boolean;
}

function monter({ enregistrees = [A, B, C], lignes = [A, B, C], enabled = true, champ, reponse, session = true }: Montage = {}) {
  const getDiscussionSpace = vi.fn(async () => espace(session));
  const entity = session ? { userContext: { id: UTILISATEUR } } : null;
  const cocolight = { api: { discussions: { space: getDiscussionSpace } }, me: null, entity, helper: {} } as unknown as CocolightContextType;
  const client = new QueryClient();
  const rendu = render(
    <MemoryRouter initialEntries={[`/aac/commun/${COMMUN}`]}>
      <QueryClientProvider client={client}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Un commun" />
            <div data-testid="fiche"><CommunMilestoneDiscussionButton answerId={COMMUN} lineKey="1" name="Matériel" /></div>
            <CommunFormLineDiscussions answerId={COMMUN} savedDepenses={enregistrees} enabled={enabled}>
              <Formulaire lignes={lignes} champ={champ} reponse={reponse} />
            </CommunFormLineDiscussions>
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace, client };
}

const formulaire = () => screen.getByTestId("formulaire");
/** Le bouton posé sur la ligne affichée à cette POSITION du formulaire. */
const boutonDe = (position: number) => formulaire().querySelector<HTMLButtonElement>(`[data-ligne="${position}"] [data-milestone-discussion]`);
const cles = () => [...formulaire().querySelectorAll("[data-milestone-discussion]")].map(b => b.getAttribute("data-milestone-discussion"));
const param = (c: HTMLElement) => new URLSearchParams(c.querySelector("[data-url]")!.textContent ?? "").get("discussion");
async function servi({ getDiscussionSpace, client }: { getDiscussionSpace: ReturnType<typeof vi.fn>; client: QueryClient }) {
  await waitFor(() => {
    expect(getDiscussionSpace).toHaveBeenCalled();
    expect(client.isFetching()).toBe(0);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

describe("CommunFormLineDiscussions", () => {
  beforeEach(() => { modale.recu = null; soumis.mockClear(); });

  describe("quelles lignes du formulaire reçoivent un bouton", () => {
    it("chaque ligne enregistrée, à la clé de SA ligne", async () => {
      await servi(monter());
      expect(cles()).toEqual(["0", "1", "2"]);
    });

    it("une ligne qu'on vient d'ajouter n'en a pas : elle n'existe pas encore au document — les autres gardent le leur", async () => {
      await servi(monter({ lignes: [A, B, C, NOUVELLE] }));
      expect(cles()).toEqual(["0", "1", "2"]);
      expect(boutonDe(3)).toBeNull();
    });

    it("une ligne décalée par un retrait garde le fil de SA clé, pas celui de sa nouvelle place", async () => {
      // « Local » est retirée à l'écran, pas encore au document : « Matériel » remonte en tête.
      await servi(monter({ lignes: [B, C] }));
      expect(boutonDe(0)!.getAttribute("data-milestone-discussion")).toBe("1");
      expect(boutonDe(1)!.getAttribute("data-milestone-discussion")).toBe("2");
    });

    it("un document à clés creuses : c'est la CLÉ qui désigne la ligne, pas son rang", async () => {
      await servi(monter({ enregistrees: { "0": A, "3": B }, lignes: [A, B] }));
      expect(cles()).toEqual(["0", "3"]);
    });

    it("une ligne sans identifiant de palier : par sa position, tant que la liste n'a pas changé de forme", async () => {
      const x: DepenseEntry = { poste: "Ancienne", price: 1 };
      await servi(monter({ enregistrees: [x, B], lignes: [x, B] }));
      expect(cles()).toEqual(["0", "1"]);
    });

    it("… et plus dès qu'elle en a changé : la ligne sans identifiant perd son bouton, l'autre garde le sien", async () => {
      const x: DepenseEntry = { poste: "Ancienne", price: 1 };
      await servi(monter({ enregistrees: [A, x, B], lignes: [x, B] }));
      expect(boutonDe(0)).toBeNull();
      expect(boutonDe(1)!.getAttribute("data-milestone-discussion")).toBe("2");
    });

    it("une ligne pour laquelle l'espace n'a aucun fil n'a pas de bouton — comme sur la fiche", async () => {
      await servi(monter({ enregistrees: { "9": A }, lignes: [A] }));
      expect(cles()).toEqual([]);
    });

    it("sans session, seulement là où quelqu'un a écrit — comme sur la fiche", async () => {
      await servi(monter({ session: false }));
      expect(cles()).toEqual(["1"]);
    });

    it("rien quand la fiche ne lit pas ses dépenses à l'étape que l'espace connaît", async () => {
      await servi(monter({ enabled: false }));
      expect(cles()).toEqual([]);
    });

    it("rien sur un autre champ de liste que celui des dépenses du commun", async () => {
      await servi(monter({ champ: "autreListe" }));
      expect(cles()).toEqual([]);
    });

    it("rien dans un formulaire qui édite une AUTRE réponse, ou une réponse pas encore enregistrée", async () => {
      const autre = monter({ reponse: "65c3000000000000000000c9" });
      await servi(autre);
      expect(cles()).toEqual([]);
      autre.unmount();
      await servi(monter({ reponse: null }));
      expect(cles()).toEqual([]);
    });
  });

  describe("ce qu'est le bouton", () => {
    it("il dit le palier, se réduit à son icône et à son compteur, et porte un nom à lui", async () => {
      await servi(monter());
      const bouton = boutonDe(1)!;
      expect(bouton.getAttribute("aria-label")).toBe("Discuter du palier « Matériel », 2 messages, 1 non lu");
      // La ligne d'un formulaire est étroite : pas de mot, à aucune largeur — le nom accessible dit tout.
      expect(bouton.textContent).not.toContain("Discuter");
      expect(bouton.querySelector("[data-milestone-discussion-total]")?.textContent).toBe("2");
      // Le palier de la fiche, pour la même ligne, est à l'écran en même temps : deux noms distincts.
      expect(bouton.getAttribute("data-discussion-opener")).toBe("formulaire:palier:1");
      expect(screen.getByTestId("fiche").querySelector("[data-discussion-opener]")!.getAttribute("data-discussion-opener")).toBe("palier:1");
    });
  });

  describe("ce qu'il fait", () => {
    it("il ouvre l'espace sur le fil de la ligne — et NE SOUMET PAS le formulaire", async () => {
      const banc = monter();
      await servi(banc);
      fireEvent.click(boutonDe(1)!);
      await screen.findByTestId("space-modal");
      expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: chemin("1") });
      expect(param(banc.container)).toBe(cle("1"));
      expect(soumis).not.toHaveBeenCalled();
    });

    it("une seule modale : celle de la fiche, pas une seconde montée par le formulaire", async () => {
      await servi(monter());
      fireEvent.click(boutonDe(0)!);
      await screen.findByTestId("space-modal");
      expect(screen.getAllByTestId("space-modal")).toHaveLength(1);
    });

    it("à la fermeture, le focus revient au bouton DU FORMULAIRE — pas à son jumeau de la fiche", async () => {
      await servi(monter());
      fireEvent.click(boutonDe(1)!);
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(boutonDe(1));
      expect(screen.getByTestId("fiche").contains(document.activeElement)).toBe(false);
    });

    it("ouverte du palier de la fiche, c'est à lui que le focus revient", async () => {
      await servi(monter());
      const jumeau = screen.getByTestId("fiche").querySelector<HTMLButtonElement>("[data-milestone-discussion]")!;
      fireEvent.click(jumeau);
      await screen.findByTestId("space-modal");
      fireEvent.click(screen.getByText("fermer-simulé"));
      expect(document.activeElement).toBe(jumeau);
    });
  });
});
