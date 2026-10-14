// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AllStepsData, CoFormData, FormFieldMapping, SubFormFields } from "../types";
import "../i18n/i18n";

/**
 * Le bouton de discussion d'une QUESTION, à côté de son libellé — parité du bouton aux bulles du
 * formulaire legacy, au formulaire d'un commun comme à un formulaire général.
 *
 * Monté comme dans un formulaire : de vrais libellés (`FieldLabel`) dans un vrai `<form>`, sur deux
 * étapes, sous l'hôte (`FormQuestionDiscussions`). Le lanceur, la requête, la lecture de l'espace,
 * l'hôte de la modale et l'adresse sont les vrais ; l'appel au serveur est la frontière ; la modale
 * a ses propres tests.
 */

const modale = vi.hoisted(() => ({ recus: [] as Record<string, unknown>[], prechauffages: 0 }));

// Le VRAI `lazy` de `vite-preload`, dont on compte les appels à `preload()`.
vi.mock("vite-preload", async importOriginal => {
  const reel = await importOriginal<typeof import("vite-preload")>();
  const lazy: typeof reel.lazy = factory => {
    const composant = reel.lazy(factory);
    const prechauffer = composant.preload;
    composant.preload = () => {
      modale.prechauffages += 1;
      return prechauffer();
    };
    return composant;
  };
  return { ...reel, lazy };
});

vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
// La liste de dépenses (un cas de lecture plus bas) lit la ressource de financement du site et les droits de la
// cagnotte : deux frontières, neutres ici — seul son libellé est en cause.
vi.mock("@/modules/aac/hooks/useAacFundingResource", () => ({ useAacFundingResource: () => ({ targetResource: undefined }) }));
vi.mock("@/modules/cagnotte/hooks/useCagnottePermissions", () => ({
  useCagnottePermissions: () => ({
    canCreateMilestone: false, canEditMilestone: () => false, canCloseMilestone: () => false,
    canRestoreMilestone: () => false, canDeleteMilestone: () => false, isConnected: true,
  }),
}));
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

const { FieldLabel } = await import("./FormFields");
const { FormQuestionDiscussions } = await import("./FormQuestionDiscussions");
const { FormStepKeyContext } = await import("../contexts/FormStepKeyContext");
const { parseCoFormFields } = await import("../utils/formParser");
const { CoFormReadOnly } = await import("./CoFormReadOnly");

const FORMULAIRE = "65c3000000000000000000f1";
const ETAPE_UN = "65c3000000000000000000e1";   // l'`_id` de l'étape « etapeUn_0 »
const ETAPE_DEUX = "65c3000000000000000000e2"; // celui de « etapeDeux_1 »
const REPONSE = "65c3000000000000000000a1";
const UTILISATEUR = "65d4000000000000000000d1";

const chemin = (etape: string, question: string) => `${FORMULAIRE}.${etape}.${REPONSE}.${question}.question_${question}.comment`;
const cle = (etape: string, question: string) => `forms:${FORMULAIRE}:${chemin(etape, question)}`;
const fil = (etape: string, step: string, question: string, over: Record<string, unknown> = {}) => ({
  key: cle(etape, question), contextType: "forms", contextId: FORMULAIRE, path: chemin(etape, question), title: question,
  carrier: null, total: 0, unread: 0, last: null, mine: false, virtual: true, kind: "question", group: "Étape",
  audience: null, line: null, step, ...over,
});

/**
 * L'espace de la réponse : « projet » commenté à l'étape un, « budget » à lancer, et une question
 * « projet » à l'étape deux — même clé, autre étape. Rien pour « sansFil », pourtant ouverte.
 */
const espace = (session: boolean) => ({
  result: true,
  space: { type: "answers", id: REPONSE, title: null, formId: FORMULAIRE },
  canComment: session,
  truncated: false,
  creatableAudiences: [],
  threads: [
    { key: `answers:${REPONSE}`, contextType: "answers", contextId: REPONSE, path: null, title: null, carrier: null, total: 0,
      unread: 0, last: null, mine: false, virtual: true, kind: "general", group: null, audience: null, line: null, step: null },
    fil(ETAPE_UN, "etapeUn_0", "projet", { virtual: false, total: 3, unread: session ? 2 : 0, last: 1_758_000_100 }),
    fil(ETAPE_UN, "etapeUn_0", "budget"),
    fil(ETAPE_DEUX, "etapeDeux_1", "projet", { virtual: false, total: 1, last: 1_758_000_050 }),
    // Un choix multiple : le formulaire range sa clé sous un préfixe (`multiRadiochoix`), le chemin non.
    fil(ETAPE_UN, "etapeUn_0", "choix", { virtual: false, total: 5, last: 1_758_000_020 }),
    fil(ETAPE_UN, "etapeUn_0", "longue"),
  ],
});

const question = (name: string, label: string, over: Partial<FormFieldMapping> = {}) =>
  ({ name, label, isRequired: false, componentType: "text", activeComments: true, ...over }) as FormFieldMapping;
const PROJET = question("projet", "Votre projet");
const BUDGET = question("budget", "Budget prévisionnel");
const SANS_FIL = question("sansFil", "Ouverte, mais rien côté serveur");
const FERMEE = question("nom", "Nom du projet", { activeComments: undefined });
const CHOIX = question("multiRadiochoix", "Votre choix", { componentType: "multiRadio" });
const LONGUE = question("longue", `Décrivez ${"très ".repeat(30)}longuement votre projet`);

/** Les étapes telles que le formulaire les a parsées : l'hôte n'ouvre rien sans question ouverte. */
const ETAPES: SubFormFields[] = [
  { subFormId: "etapeUn_0", subFormName: "Première étape", fields: [PROJET, BUDGET, SANS_FIL, FERMEE, CHOIX, LONGUE] },
  { subFormId: "etapeDeux_1", subFormName: "Seconde étape", fields: [question("projet", "Le projet, vu par le jury")] },
];

const soumis = vi.fn();

function SondeUrl() {
  const { search } = useLocation();
  return <span data-url>{search}</span>;
}

interface Montage {
  readonly session?: boolean;
  /** La réponse que montre le formulaire ; `null` : un dépôt pas encore enregistré. */
  readonly reponse?: string | null;
  /** Sans hôte : un formulaire que rien n'entoure. */
  readonly hote?: boolean;
  /** Le formulaire est un appel à projets : son espace est celui d'un commun. */
  readonly commun?: boolean;
  /** Les étapes parsées que l'hôte reçoit — par défaut, celles du formulaire monté. */
  readonly etapes?: SubFormFields[];
}

function monter({ session = true, reponse = REPONSE, hote = true, commun = false, etapes = ETAPES }: Montage = {}) {
  const getDiscussionSpace = vi.fn(async () => espace(session));
  const entity = session ? { userContext: { id: UTILISATEUR } } : null;
  const cocolight = { api: { getDiscussionSpace }, me: null, entity, helper: {} } as unknown as CocolightContextType;
  const formulaire = (
    <form data-testid="formulaire" onSubmit={event => { event.preventDefault(); soumis(); }}>
      <FormStepKeyContext.Provider value="etapeUn_0">
        <div data-etape="un">
          <FieldLabel field={PROJET} htmlFor="champ-projet" />
          <input id="champ-projet" />
          <FieldLabel field={BUDGET} />
          <FieldLabel field={SANS_FIL} />
          <FieldLabel field={FERMEE} htmlFor="champ-nom" />
          <input id="champ-nom" />
          <FieldLabel field={CHOIX} />
          <FieldLabel field={LONGUE} />
        </div>
      </FormStepKeyContext.Provider>
      <FormStepKeyContext.Provider value="etapeDeux_1">
        <div data-etape="deux">
          <FieldLabel field={question("projet", "Le projet, vu par le jury")} />
        </div>
      </FormStepKeyContext.Provider>
    </form>
  );
  const rendu = render(
    <MemoryRouter initialEntries={["/coform/un-formulaire"]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            {hote ? (
              <FormQuestionDiscussions answerId={reponse} form={{ name: "Formulaire de test", type: commun ? "aap" : "form" }} steps={etapes}>
                {formulaire}
              </FormQuestionDiscussions>
            ) : formulaire}
            <SondeUrl />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendu, getDiscussionSpace };
}

const etape = (nom: "un" | "deux") => document.querySelector<HTMLElement>(`[data-etape="${nom}"]`)!;
const boutonDe = (cleQuestion: string, ou: "un" | "deux" = "un") =>
  etape(ou).querySelector<HTMLButtonElement>(`[data-question-discussion="${cleQuestion}"]`);
const discussionDansLAdresse = (container: HTMLElement) =>
  new URLSearchParams(container.querySelector("[data-url]")!.textContent ?? "").get("discussion");

beforeEach(() => {
  modale.recus = [];
  modale.prechauffages = 0;
  soumis.mockClear();
});

describe("le bouton de discussion d'une question", () => {
  it("une question ouverte et commentée : son bouton, ses compteurs, et il ouvre l'espace sur SON fil", async () => {
    const { container } = monter();
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    const bouton = boutonDe("projet")!;
    expect(bouton.querySelector("[data-question-discussion-total]")?.textContent).toBe("3");
    expect(bouton.querySelector("[data-question-discussion-unread]")?.textContent).toBe("2");
    expect(bouton.getAttribute("aria-label")).toBe("Commenter la question « Votre projet », 3 messages, 2 non lus");
    expect(bouton.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByTestId("space-modal")).toBeNull();

    act(() => { fireEvent.click(bouton); });
    expect(discussionDansLAdresse(container)).toBe(cle(ETAPE_UN, "projet"));
    // La modale arrive par un import différé : on l'attend.
    expect(await screen.findAllByTestId("space-modal")).toHaveLength(1);
    // Une réponse à un formulaire général : son espace se nomme « réponse », titré du formulaire.
    expect(modale.recus[modale.recus.length - 1]).toMatchObject({ title: "Formulaire de test", subject: "answer", space: { type: "answers", id: REPONSE } });
  });

  it("une question ouverte que personne n'a commentée : un bouton sans compteur, qui lance SON fil", async () => {
    const { container } = monter();
    await waitFor(() => expect(boutonDe("budget")).not.toBeNull());
    expect(boutonDe("budget")!.querySelector("[data-question-discussion-total]")).toBeNull();
    act(() => { fireEvent.click(boutonDe("budget")!); });
    expect(discussionDansLAdresse(container)).toBe(cle(ETAPE_UN, "budget"));
  });

  it("même clé de question dans deux étapes : chaque libellé ouvre le fil de SON étape, avec SES compteurs", async () => {
    const { container } = monter();
    await waitFor(() => expect(boutonDe("projet", "deux")).not.toBeNull());
    expect(boutonDe("projet", "deux")!.querySelector("[data-question-discussion-total]")?.textContent).toBe("1");
    act(() => { fireEvent.click(boutonDe("projet", "deux")!); });
    expect(discussionDansLAdresse(container)).toBe(cle(ETAPE_DEUX, "projet"));
  });

  it("question fermée aux commentaires, ou que l'espace ne porte pas : pas de bouton — la liste du serveur fait autorité", async () => {
    monter();
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    expect(boutonDe("nom")).toBeNull();
    expect(boutonDe("sansFil")).toBeNull();
    // Fermée, son libellé reste celui d'avant : rien autour de lui.
    expect(document.querySelector('label[for="champ-nom"]')?.parentElement?.getAttribute("data-etape")).toBe("un");
  });

  it("une question à clé préfixée par le formulaire (`multiRadiochoix`) : sa discussion se cherche à sa clé d'origine", async () => {
    const { container } = monter();
    await waitFor(() => expect(boutonDe("choix")).not.toBeNull());
    expect(boutonDe("choix")!.querySelector("[data-question-discussion-total]")?.textContent).toBe("5");
    act(() => { fireEvent.click(boutonDe("choix")!); });
    expect(discussionDansLAdresse(container)).toBe(cle(ETAPE_UN, "choix"));
  });

  it("un très long libellé est coupé dans le nom du bouton — le libellé entier est juste à côté", async () => {
    monter();
    await waitFor(() => expect(boutonDe("longue")).not.toBeNull());
    // Quatre-vingts signes au plus, points de suspension compris.
    const coupe = `${LONGUE.label.slice(0, 79).trimEnd()}…`;
    expect(boutonDe("longue")!.getAttribute("aria-label")).toBe(`Commenter la question « ${coupe} »`);
  });

  it("le code de la modale est préchauffé dès qu'on vise le bouton", async () => {
    monter();
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    act(() => { fireEvent.mouseEnter(boutonDe("projet")!); });
    expect(modale.prechauffages).toBe(1);
    act(() => { fireEvent.focus(boutonDe("budget")!); });
    expect(modale.prechauffages).toBe(2);
  });

  it("le formulaire d'un appel à projets : l'espace qu'il ouvre est celui d'un commun", async () => {
    monter({ commun: true });
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    act(() => { fireEvent.click(boutonDe("projet")!); });
    await screen.findByTestId("space-modal");
    expect(modale.recus[modale.recus.length - 1]).toMatchObject({ subject: "commun" });
  });

  it("le bouton est HORS du `<label>`, et ne soumet pas le formulaire", async () => {
    monter();
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    const label = document.querySelector('label[for="champ-projet"]')!;
    expect(label.contains(boutonDe("projet"))).toBe(false);
    expect(label.closest("[data-question-label]")?.contains(boutonDe("projet"))).toBe(true);
    expect(boutonDe("projet")!.getAttribute("type")).toBe("button");
    act(() => { fireEvent.click(boutonDe("projet")!); });
    expect(soumis).not.toHaveBeenCalled();
  });

  it("la modale fermée, le focus revient au bouton de la question d'où l'on a ouvert", async () => {
    monter();
    await waitFor(() => expect(boutonDe("projet", "deux")).not.toBeNull());
    const bouton = boutonDe("projet", "deux")!;
    act(() => { bouton.focus(); fireEvent.click(bouton); });
    expect(await screen.findByTestId("space-modal")).toBeTruthy();
    // La vraie modale prend le focus (piège d'un dialogue Radix) : la doublure le prend aussi — sans quoi
    // le focus n'aurait jamais quitté le bouton, et son retour ne prouverait rien.
    act(() => { screen.getByText("fermer-simulé").focus(); });
    expect(document.activeElement).toBe(screen.getByText("fermer-simulé"));
    act(() => { fireEvent.click(screen.getByText("fermer-simulé")); });
    await waitFor(() => expect(screen.queryByTestId("space-modal")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(bouton));
  });

  it("visiteur : le fil commenté reste ouvrable, la question vierge n'a rien à lui offrir", async () => {
    monter({ session: false });
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    expect(boutonDe("budget")).toBeNull();
    expect(boutonDe("projet")!.querySelector("[data-question-discussion-unread]")).toBeNull();
  });

  it("un dépôt pas encore enregistré : le libellé seul, rien n'est demandé au serveur", async () => {
    const { getDiscussionSpace } = monter({ reponse: null });
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector("[data-question-discussion]")).toBeNull();
    expect(document.querySelector("[data-question-label]")).toBeNull();
    expect(getDiscussionSpace).not.toHaveBeenCalled();
  });

  it("un formulaire qu'aucun hôte n'entoure : le libellé seul, comme avant — et aucune requête", async () => {
    const { getDiscussionSpace } = monter({ hote: false });
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector("[data-question-label]")).toBeNull();
    expect(document.querySelector('label[for="champ-projet"]')?.parentElement?.getAttribute("data-etape")).toBe("un");
    expect(getDiscussionSpace).not.toHaveBeenCalled();
  });

  it("une seule requête pour toutes les questions de la réponse", async () => {
    const { getDiscussionSpace } = monter();
    await waitFor(() => expect(boutonDe("projet", "deux")).not.toBeNull());
    expect(getDiscussionSpace).toHaveBeenCalledTimes(1);
  });
});

describe("l'hôte des discussions (`FormQuestionDiscussions`)", () => {
  it("aucune question ouverte dans ses étapes : il n'ouvre rien — ni bouton, ni requête", async () => {
    const { getDiscussionSpace } = monter({ etapes: [{ subFormId: "etapeUn_0", subFormName: "Un", fields: [FERMEE] }] });
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector("[data-question-discussion]")).toBeNull();
    expect(document.querySelector("[data-question-label]")).toBeNull();
    expect(getDiscussionSpace).not.toHaveBeenCalled();
  });

  /** Le formulaire seul, sous l'hôte, avec ce qu'on veut bien lui fournir autour. */
  const seul = (avecSession: boolean) => {
    const contenu = (
      <FormQuestionDiscussions answerId={REPONSE} form={{ name: "Formulaire de test", type: "form" }} steps={ETAPES}>
        <FormStepKeyContext.Provider value="etapeUn_0">
          <div data-etape="un"><FieldLabel field={PROJET} htmlFor="champ-projet" /><input id="champ-projet" /></div>
        </FormStepKeyContext.Provider>
      </FormQuestionDiscussions>
    );
    const cocolight = { api: { getDiscussionSpace: vi.fn() }, me: null, entity: null, helper: {} } as unknown as CocolightContextType;
    return avecSession ? <CocolightContext.Provider value={cocolight}><LocalizationProvider>{contenu}</LocalizationProvider></CocolightContext.Provider> : <LocalizationProvider>{contenu}</LocalizationProvider>;
  };

  it("hors d'une session Cocolight — `SmartCoForm` sait vivre sans elle — : le libellé seul, sans planter", () => {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}>{seul(false)}</QueryClientProvider></MemoryRouter>);
    expect(document.querySelector('label[for="champ-projet"]')?.textContent).toContain("Votre projet");
    expect(document.querySelector("[data-question-label]")).toBeNull();
  });

  it("hors d'un routeur : le libellé seul, sans planter", () => {
    render(<QueryClientProvider client={new QueryClient()}>{seul(true)}</QueryClientProvider>);
    expect(document.querySelector('label[for="champ-projet"]')?.textContent).toContain("Votre projet");
    expect(document.querySelector("[data-question-label]")).toBeNull();
  });

  it("une réponse qui reçoit son identifiant ne fait pas remonter ce qu'il entoure", async () => {
    const { rerender } = monter({ reponse: null });
    const champ = document.querySelector<HTMLInputElement>("#champ-projet")!;
    champ.value = "saisie en cours";
    const ETAPE = document.querySelector('[data-etape="un"]');
    const cocolight = { api: { getDiscussionSpace: vi.fn(async () => espace(true)) }, me: null, entity: { userContext: { id: UTILISATEUR } }, helper: {} } as unknown as CocolightContextType;
    rerender(
      <MemoryRouter initialEntries={["/coform/un-formulaire"]}>
        <QueryClientProvider client={new QueryClient()}>
          <CocolightContext.Provider value={cocolight}>
            <LocalizationProvider>
              <FormQuestionDiscussions answerId={REPONSE} form={{ name: "Formulaire de test", type: "form" }} steps={ETAPES}>
                <form data-testid="formulaire">
                  <FormStepKeyContext.Provider value="etapeUn_0">
                    <div data-etape="un">
                      <FieldLabel field={PROJET} htmlFor="champ-projet" />
                      <input id="champ-projet" />
                    </div>
                  </FormStepKeyContext.Provider>
                </form>
              </FormQuestionDiscussions>
            </LocalizationProvider>
          </CocolightContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(boutonDe("projet")).not.toBeNull());
    // Les MÊMES nœuds : rien n'a été remonté, la saisie est là.
    expect(document.querySelector('[data-etape="un"]')).toBe(ETAPE);
    expect(document.querySelector<HTMLInputElement>("#champ-projet")).toBe(champ);
    expect(champ.value).toBe("saisie en cours");
  });
});

describe("en lecture (`CoFormReadOnly`)", () => {
  // Le legacy montre le bouton en lecture aussi : la réponse affichée, une question ouverte de son étape.
  const FORMULAIRE_LU = {
    id: FORMULAIRE,
    _id: { _str: FORMULAIRE },
    name: "Formulaire de test",
    inputs: {
      etapeUn_0: {
        name: "Première étape",
        inputs: {
          projet: { type: "text", label: "Votre projet", activeComments: true, position: 0 },
          nom: { type: "text", label: "Nom du projet", position: 1 },
        },
      },
    },
  } as unknown as CoFormData;

  it("une question ouverte reçoit son bouton dans son libellé de lecture ; une question fermée garde le libellé seul", async () => {
    const getDiscussionSpace = vi.fn(async () => espace(true));
    const cocolight = { api: { getDiscussionSpace }, me: null, entity: { userContext: { id: UTILISATEUR } }, helper: {} } as unknown as CocolightContextType;
    render(
      <MemoryRouter initialEntries={["/coform/un-formulaire/answer/une-reponse"]}>
        <QueryClientProvider client={new QueryClient()}>
          <CocolightContext.Provider value={cocolight}>
            <LocalizationProvider>
              <FormQuestionDiscussions answerId={REPONSE} form={FORMULAIRE_LU} steps={parseCoFormFields(FORMULAIRE_LU)}>
                <CoFormReadOnly
                  formData={FORMULAIRE_LU}
                  answerData={{ etapeUn_0: { projet: "Un lieu partagé", nom: "Atelier" } } as unknown as AllStepsData}
                  answerId={REPONSE}
                  hideBanner
                  hideMetadata
                />
              </FormQuestionDiscussions>
            </LocalizationProvider>
          </CocolightContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('[data-question-discussion="projet"]')).not.toBeNull());
    const bouton = document.querySelector<HTMLButtonElement>('[data-question-discussion="projet"]')!;
    expect(bouton.closest("dt")?.textContent).toContain("Votre projet");
    expect(bouton.querySelector("[data-question-discussion-total]")?.textContent).toBe("3");
    // La question fermée garde son libellé de lecture d'avant : le texte seul, rien autour.
    const fermee = [...document.querySelectorAll("dt")].find(dt => dt.textContent === "Nom du projet");
    expect(fermee).toBeDefined();
    expect(fermee!.children).toHaveLength(0);
  });

  it("sans hôte, une question ouverte garde son libellé de lecture seul — et rien n'est demandé", async () => {
    const getDiscussionSpace = vi.fn(async () => espace(true));
    const cocolight = { api: { getDiscussionSpace }, me: null, entity: { userContext: { id: UTILISATEUR } }, helper: {} } as unknown as CocolightContextType;
    render(
      <MemoryRouter initialEntries={["/coform/un-formulaire/answer/une-reponse"]}>
        <QueryClientProvider client={new QueryClient()}>
          <CocolightContext.Provider value={cocolight}>
            <LocalizationProvider>
              <CoFormReadOnly formData={FORMULAIRE_LU} answerData={{ etapeUn_0: { projet: "Un lieu", nom: "Atelier" } } as unknown as AllStepsData}
                answerId={REPONSE} hideBanner hideMetadata />
            </LocalizationProvider>
          </CocolightContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await act(async () => { await Promise.resolve(); });
    const ouverte = [...document.querySelectorAll("dt")].find(dt => dt.textContent === "Votre projet");
    expect(ouverte?.children).toHaveLength(0);
    expect(getDiscussionSpace).not.toHaveBeenCalled();
  });

  it("une liste de dépenses ouverte aux commentaires : UN libellé, UN bouton — le champ ne répète pas le sien", async () => {
    const AVEC_LISTE = {
      ...FORMULAIRE_LU,
      inputs: { etapeUn_0: { name: "Première étape", inputs: {
        depense: { type: "tpls.forms.ocecoform.newDepenseList", label: "Budget prévisionnel", activeComments: true, position: 0 },
      } } },
    } as unknown as CoFormData;
    const getDiscussionSpace = vi.fn(async () => ({ ...espace(true), threads: [fil(ETAPE_UN, "etapeUn_0", "depense", { virtual: false, total: 2 })] }));
    const cocolight = { api: { getDiscussionSpace }, me: null, entity: { userContext: { id: UTILISATEUR } }, helper: {} } as unknown as CocolightContextType;
    render(
      <MemoryRouter initialEntries={["/coform/un-formulaire/answer/une-reponse"]}>
        <QueryClientProvider client={new QueryClient()}>
          <CocolightContext.Provider value={cocolight}>
            <LocalizationProvider>
              <FormQuestionDiscussions answerId={REPONSE} form={AVEC_LISTE} steps={parseCoFormFields(AVEC_LISTE)}>
                <CoFormReadOnly formData={AVEC_LISTE} answerData={{ etapeUn_0: { depense: [] } } as unknown as AllStepsData}
                  answerId={REPONSE} hideBanner hideMetadata />
              </FormQuestionDiscussions>
            </LocalizationProvider>
          </CocolightContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('[data-question-discussion="depense"]')).not.toBeNull());
    expect(document.querySelectorAll('[data-question-discussion="depense"]')).toHaveLength(1);
    expect([...document.querySelectorAll("dt, label, [data-question-label]")].filter(e => e.textContent?.includes("Budget prévisionnel"))).toHaveLength(1);
  });
});

