// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { FieldLabel } from "@/modules/coform/components/FormFields";
import { FormQuestionDiscussions } from "@/modules/coform/components/FormQuestionDiscussions";
import { FormStepKeyContext } from "@/modules/coform/contexts/FormStepKeyContext";
import type { FormFieldMapping, SubFormFields } from "@/modules/coform/types";
import "../../i18n";

/**
 * Le formulaire d'édition d'un commun, ouvert PAR-DESSUS sa fiche : ses questions ouvertes aux
 * commentaires ont leur bouton, et la modale qu'il ouvre est celle de la fiche — UNE par espace et
 * par page. Le formulaire est hôte lui aussi, de rang moindre : il s'efface, qu'il soit monté avant
 * la fiche ou après elle.
 *
 * Le bouton de la fiche, le formulaire (un vrai libellé de question sous le vrai hôte), le lanceur,
 * la requête et l'adresse sont les vrais ; l'appel au serveur est la frontière ; la modale a ses
 * propres tests.
 */

const modale = vi.hoisted(() => ({ recus: [] as Record<string, unknown>[] }));

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/panel/SpaceModal", () => ({
  default: (props: { onOpenChange: (open: boolean) => void } & Record<string, unknown>) => {
    modale.recus.push(props);
    return (
      <div data-testid="space-modal">
        <button type="button" onClick={() => props.onOpenChange(false)}>fermer-simulé</button>
      </div>
    );
  },
}));

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";
const DEPOT = "65c3000000000000000000e1";
const UTILISATEUR = "65d4000000000000000000d1";
const chemin = `${APPEL}.${DEPOT}.${COMMUN}.titre.question_titre.comment`;

const espace = () => ({
  result: true,
  space: { type: "answers", id: COMMUN, title: "Un commun", formId: APPEL },
  canComment: true,
  truncated: false,
  creatableAudiences: ["authorAll"],
  threads: [
    { key: `forms:${APPEL}:${chemin}`, contextType: "forms", contextId: APPEL, path: chemin, title: "Titre du projet", carrier: null,
      total: 2, unread: 1, last: 1_758_000_100, mine: false, virtual: false, kind: "question", group: "Dépôt", audience: null,
      line: null, step: "aapStep1" },
  ],
});

const TITRE = { name: "titre", label: "Titre du projet", isRequired: true, componentType: "text", activeComments: true } as FormFieldMapping;
const ETAPES: SubFormFields[] = [{ subFormId: "aapStep1", subFormName: "Dépôt", fields: [TITRE] }];

function monter(formulaireDAbord: boolean) {
  const getDiscussionSpace = vi.fn(async () => espace());
  const cocolight = { api: { discussions: { space: getDiscussionSpace } }, me: null, entity: { userContext: { id: UTILISATEUR } }, helper: {} } as unknown as CocolightContextType;
  const fiche = <CommunDiscussionControl key="fiche" answerId={COMMUN} communTitle="Un commun" />;
  const formulaire = (
    <FormQuestionDiscussions key="formulaire" answerId={COMMUN} form={{ name: "Appel à communs", type: "aap" }} steps={ETAPES}>
      <form data-testid="formulaire">
        <FormStepKeyContext.Provider value="aapStep1">
          <FieldLabel field={TITRE} htmlFor="champ-titre" />
          <input id="champ-titre" />
        </FormStepKeyContext.Provider>
      </form>
    </FormQuestionDiscussions>
  );
  render(
    <MemoryRouter initialEntries={[`/aac/commun/${COMMUN}`]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>{formulaireDAbord ? [formulaire, fiche] : [fiche, formulaire]}</LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { getDiscussionSpace };
}

const boutonDeLaQuestion = () => screen.getByTestId("formulaire").querySelector<HTMLButtonElement>('[data-question-discussion="titre"]');

beforeEach(() => {
  modale.recus = [];
});

describe("le formulaire d'un commun, par-dessus sa fiche", () => {
  it.each([[false], [true]])("formulaire monté avant la fiche : %s — une seule modale, celle de la fiche", async formulaireDAbord => {
    const { getDiscussionSpace } = monter(formulaireDAbord);
    await waitFor(() => expect(boutonDeLaQuestion()).not.toBeNull());
    expect(boutonDeLaQuestion()!.querySelector("[data-question-discussion-total]")?.textContent).toBe("2");
    act(() => { fireEvent.click(boutonDeLaQuestion()!); });
    expect(await screen.findAllByTestId("space-modal")).toHaveLength(1);
    // La modale de la FICHE : titrée du commun, nommée « commun » — pas celle du formulaire.
    expect(modale.recus[modale.recus.length - 1]).toMatchObject({ title: "Un commun", target: { type: "forms", id: APPEL, path: chemin } });
    expect(modale.recus[modale.recus.length - 1].subject).toBeUndefined();
    // Une seule requête : la fiche et le formulaire lisent le même espace.
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
  });

  it("fermée, la modale de la fiche rend le focus au bouton de la question d'où l'on a ouvert", async () => {
    monter(false);
    await waitFor(() => expect(boutonDeLaQuestion()).not.toBeNull());
    const bouton = boutonDeLaQuestion()!;
    act(() => { bouton.focus(); fireEvent.click(bouton); });
    await screen.findByTestId("space-modal");
    // La vraie modale prend le focus (piège d'un dialogue Radix) : la doublure le prend aussi — sans quoi
    // le focus n'aurait jamais quitté le bouton, et son retour ne prouverait rien.
    act(() => { screen.getByText("fermer-simulé").focus(); });
    expect(document.activeElement).toBe(screen.getByText("fermer-simulé"));
    act(() => { fireEvent.click(screen.getByText("fermer-simulé")); });
    await waitFor(() => expect(screen.queryByTestId("space-modal")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(bouton));
  });
});
