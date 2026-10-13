// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { FormFieldMapping } from "@/modules/coform/types";
import type { DepenseEntry } from "@/modules/coform/utils/depense";
import "@/modules/coform/i18n/i18n";
import "../../i18n";

/**
 * Le bouton « Discuter » du formulaire, sur le VRAI champ de dépenses.
 *
 * Les tests voisins jugent chaque maillon contre une doublure de l'autre : le fournisseur contre un
 * formulaire témoin, le champ contre un faux emplacement. Ici les deux sont les vrais, montés l'un
 * dans l'autre — c'est ce qui casserait sans bruit si le champ changeait ce qu'il dit de ses lignes.
 * Les gestes sont ceux de l'écran : retirer une ligne, en ajouter une, déplier les archivées.
 *
 * Restent remplacés : l'appel au serveur (l'espace de discussion), la modale — qui a ses tests —, et
 * les deux lectures que le champ fait pour la cagnotte, sans objet ici.
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
vi.mock("@/modules/aac/hooks/useAacFundingResource", () => ({
  useAacFundingResource: () => ({ targetResource: undefined }),
}));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => ({ currentUserId: "65d4000000000000000000d1" }),
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");
const { CommunFormLineDiscussions } = await import("./CommunFormLineDiscussions");
const { MilestoneListField } = await import("@/modules/coform/components/MilestoneListField");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const FINANCEMENT = "65c3000000000000000000e3";

const chemin = (ligne: string) =>
  `${APPEL}.${FINANCEMENT}.${COMMUN}.financer.question_financer.comment.financement.depensekey.aapStep1-depense.depenseindex.${ligne}`;
const fil = (ligne: string) => ({
  key: `forms:${APPEL}:${chemin(ligne)}`, contextType: "forms", contextId: APPEL, path: chemin(ligne), title: null, carrier: null, total: 0,
  unread: 0, last: null, mine: false, virtual: true, kind: "expense", group: "Financement", audience: null, line: ligne,
});
const espace = {
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: true,
  truncated: false,
  threads: [fil("0"), fil("1"), fil("2")],
};

const LOCAL: DepenseEntry = { poste: "Local", price: 100, milestone: "m-a" };
const MATERIEL: DepenseEntry = { poste: "Matériel", price: 200, milestone: "m-b" };
const SALAIRES: DepenseEntry = { poste: "Salaires", price: 300, milestone: "m-c" };

const CHAMP = {
  name: "depense",
  label: "Les étapes du projet et leur besoin financier",
  type: "tpls.forms.ocecoform.newDepenseList",
  componentType: "milestoneList",
  isRequired: false,
} as unknown as FormFieldMapping;

const soumis = vi.fn();

/** Le formulaire : un vrai `<form>`, le vrai champ, et la valeur qu'il tient — comme react-hook-form la lui rend. */
function Formulaire({ depart }: { depart: DepenseEntry[] }) {
  const [valeur, setValeur] = useState(depart);
  return (
    <form data-testid="formulaire" onSubmit={event => { event.preventDefault(); soumis(); }}>
      <MilestoneListField field={CHAMP} errors={{}} value={valeur} onChange={setValeur} answerId={COMMUN} />
    </form>
  );
}

function monter(enregistrees: DepenseEntry[] = [LOCAL, MATERIEL, SALAIRES]) {
  const getDiscussionSpace = vi.fn(async () => espace);
  const cocolight = { api: { getDiscussionSpace }, me: null, entity: { userContext: { id: "65d4000000000000000000d1" } }, helper: {} } as unknown as CocolightContextType;
  const client = new QueryClient();
  const rendu = render(
    <MemoryRouter initialEntries={[`/aac/commun/${COMMUN}`]}>
      <QueryClientProvider client={client}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Un commun" />
            <CommunFormLineDiscussions answerId={COMMUN} savedDepenses={enregistrees} enabled>
              <Formulaire depart={enregistrees} />
            </CommunFormLineDiscussions>
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace, client };
}

async function servi({ getDiscussionSpace, client }: { getDiscussionSpace: ReturnType<typeof vi.fn>; client: QueryClient }) {
  await waitFor(() => {
    expect(getDiscussionSpace).toHaveBeenCalled();
    expect(client.isFetching()).toBe(0);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

/** La carte d'une ligne du champ, retrouvée par son intitulé. */
const carte = (intitule: string) => screen.getByRole("heading", { level: 4, name: intitule }).closest<HTMLElement>(".group")!;
/** Le bouton de discussion de cette ligne, et la clé qu'il porte. */
const boutonDe = (intitule: string) => carte(intitule).querySelector<HTMLButtonElement>("[data-milestone-discussion]");
const cleDe = (intitule: string) => boutonDe(intitule)?.getAttribute("data-milestone-discussion") ?? null;

describe("CommunFormLineDiscussions — sur le vrai champ de dépenses", () => {
  beforeEach(() => { modale.recu = null; soumis.mockClear(); });

  it("chaque ligne enregistrée porte son bouton, dans l'en-tête de SA carte, à la clé de sa ligne", async () => {
    await servi(monter());
    expect([cleDe("Local"), cleDe("Matériel"), cleDe("Salaires")]).toEqual(["0", "1", "2"]);
    const bouton = boutonDe("Matériel")!;
    // À côté du bouton qui déplie la carte, pas dedans.
    expect(bouton.closest("[aria-expanded]")).toBeNull();
    expect(bouton.parentElement!.querySelector(":scope > button[aria-expanded]")!.textContent).toContain("Matériel");
    expect(bouton.getAttribute("aria-label")).toContain("Discuter du palier « Matériel »");
  });

  it("retirer la première ligne : les suivantes remontent à l'écran et gardent le fil de LEUR clé", async () => {
    await servi(monter());
    fireEvent.click(within(carte("Local")).getByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Oui, supprimer" }));
    await waitFor(() => expect(screen.queryByRole("heading", { level: 4, name: "Local" })).toBeNull());
    // « Matériel » est maintenant le palier 1 à l'écran ; au document, sa clé est toujours « 1 ».
    expect(carte("Matériel").textContent).toContain("Palier 1");
    expect([cleDe("Matériel"), cleDe("Salaires")]).toEqual(["1", "2"]);

    fireEvent.click(boutonDe("Matériel")!);
    await screen.findByTestId("space-modal");
    expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: chemin("1") });
  });

  it("ajouter une ligne : elle n'a pas de bouton tant qu'elle n'est pas enregistrée — les autres gardent le leur", async () => {
    await servi(monter());
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un palier/ }));
    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Communication" } });
    fireEvent.change(screen.getByLabelText("Montant cible"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await screen.findByRole("heading", { level: 4, name: "Communication" });
    expect(boutonDe("Communication")).toBeNull();
    expect([cleDe("Local"), cleDe("Matériel"), cleDe("Salaires")]).toEqual(["0", "1", "2"]);
  });

  it("une ligne clôturée, repliée avec les archivées, reçoit le sien une fois dépliée — à sa clé", async () => {
    await servi(monter([{ ...LOCAL, include: false }, MATERIEL]));
    expect(screen.queryByRole("heading", { level: 4, name: "Local" })).toBeNull();
    expect(cleDe("Matériel")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /archivé/ }));
    expect(cleDe("Local")).toBe("0");
  });

  it("cliquer le bouton ouvre la discussion SANS soumettre le formulaire, et le focus lui revient", async () => {
    await servi(monter());
    fireEvent.click(boutonDe("Salaires")!);
    await screen.findByTestId("space-modal");
    expect(soumis).not.toHaveBeenCalled();
    expect(modale.recu!.target).toEqual({ type: "forms", id: APPEL, path: chemin("2") });
    fireEvent.click(screen.getByText("fermer-simulé"));
    expect(document.activeElement).toBe(boutonDe("Salaires"));
    // Le champ est toujours là, avec ses lignes : rien n'a été remonté.
    expect([cleDe("Local"), cleDe("Matériel"), cleDe("Salaires")]).toEqual(["0", "1", "2"]);
  });
});
