// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";

/**
 * Onglet « Structures » : ce que l'admin d'une structure voit et peut faire.
 *  - rien de ce qui dépend de `me` avant l'hydratation (HTML serveur = 1er rendu client) ;
 *  - ses structures (admin validé, périmètre du site), chacune avec ses créneaux et leur statut ;
 *  - chargement, erreur et vide disent quoi faire, pour la liste comme pour chaque structure ;
 *  - « Ajouter un créneau » ouvre le formulaire, structure PRÉREMPLIE et MASQUÉE, brouillon rangé
 *    par structure ; l'enregistrement rafraîchit les listes du compte et déplie CETTE structure ;
 *  - le détail d'un créneau s'ouvre en lecture, ou modifiable avec `answers.editButton` ;
 *  - le statut d'une structure non validée est dit (`structureStatusField`) ;
 *  - les créneaux déposés hors de ses structures ont leur groupe (`answers.submittedSlots`).
 * Les données et les modales sont doublées : on teste le câblage, pas le serveur.
 */
interface AnswersState {
  rows?: unknown[];
  loading?: boolean;
  error?: Error;
  hasNextPage?: boolean;
}

const ctx = vi.hoisted(() => ({
  hydrated: true,
  orgs: [] as unknown[],
  orgsLoading: false,
  orgsError: null as Error | null,
  orgsRefetch: vi.fn(),
  orgParams: undefined as Record<string, unknown> | undefined,
  /** Par LISTE : l'id de la structure, ou `submitted` pour les créneaux déposés ailleurs. */
  answers: {} as Record<string, AnswersState>,
  answersRefetch: vi.fn(),
  fetchNextPage: vi.fn(),
  searchCalls: [] as {
    prefix: string;
    list: string;
    enabled?: boolean;
    filters?: Record<string, unknown>;
    fields?: string[];
  }[],
  toastSuccess: vi.fn(),
}));

const FORM = "6928096adf5caf0d230e7f26";
const SECTION = "sportSanteBienetre2172025_854_0";
const FINDER_KEY = `finder${SECTION}mdn1fzoewyjg66n85p`;
const FINDER_PATH = `answers.${SECTION}.${FINDER_KEY}`;
const ORG_A = "5f0f0f0f0f0f0f0f0f0f0f0a";
const ORG_B = "5f0f0f0f0f0f0f0f0f0f0f0b";
const ORG_C = "5f0f0f0f0f0f0f0f0f0f0f0c";
const ORG_D = "5f0f0f0f0f0f0f0f0f0f0f0d";
const ORG_TAMPON = "5f0f0f0f0f0f0f0f0f0f0f0e";
const SUBMITTED = "submitted";
/** Préfixe PARTAGÉ par toutes les listes du compte (structures et créneaux déposés). */
const PREFIX = "managed-answers:u1";
const enabledLists = () => new Set(ctx.searchCalls.filter((c) => c.enabled).map((c) => c.list));

vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => ctx.hydrated }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: { id: "u1", slug: "judi" }, entity: { slug: "sportSanteBienetre" } }),
}));
// Clé brute, et paramètres d'interpolation visibles : les assertions portent dessus. Un libellé de
// config (`{ fr, en }`) se lit en français, comme le ferait `useT` sur un site en fr.
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string | { fr?: string }, _fallback?: string, params?: Record<string, unknown>) =>
    typeof key !== "string" ? (key.fr ?? "") : params ? `${key}${JSON.stringify(params)}` : key,
}));
vi.mock("@/modules/profil/i18n", () => ({}));
vi.mock("@/modules/search/i18n", () => ({}));
vi.mock("../../hooks/useMembershipQuery", () => ({
  useUserOrganizations: (_user: unknown, params: Record<string, unknown>) => {
    ctx.orgParams = params;
    return { organizations: ctx.orgs, isLoading: ctx.orgsLoading, error: ctx.orgsError, refetch: ctx.orgsRefetch, lastItemRef: undefined };
  },
}));
// Les listes partagent un préfixe : chacune se reconnaît à ses FILTRES — `user` pour les créneaux
// déposés, sinon l'id de structure qui termine la clé du finder.
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: (p: {
    queryKeyPrefix: string;
    enabled?: boolean;
    baseParams?: { defaultFilters?: Record<string, unknown>; defaultFields?: string[] };
  }) => {
    const filters = p.baseParams?.defaultFilters ?? {};
    const list =
      "user" in filters
        ? "submitted"
        : (Object.keys(filters).find((k) => /\.finder[^.]+\.[0-9a-f]{24}$/.test(k))?.split(".").pop() ?? "?");
    ctx.searchCalls.push({ prefix: p.queryKeyPrefix, list, enabled: p.enabled, filters, fields: p.baseParams?.defaultFields });
    const etat = p.enabled ? (ctx.answers[list] ?? { rows: [] }) : {};
    return {
      data: etat.rows ? { pages: [] } : undefined,
      transformedResults: etat.rows ?? [],
      isLoading: !!etat.loading,
      error: etat.error ?? null,
      hasNextPage: !!etat.hasNextPage,
      isFetchingNextPage: false,
      fetchNextPage: () => ctx.fetchNextPage(list),
      refetch: () => ctx.answersRefetch(list),
      lastItemRef: undefined,
    };
  },
}));
vi.mock("@/components/ui/OptimizedImage", () => ({ OptimizedImage: () => <img alt="" /> }));
vi.mock("sonner", () => ({ toast: { success: ctx.toastSuccess, error: vi.fn() } }));
// Formulaire : expose ce que l'onglet lui passe ; « enregistrer » rejoue `handleAfterSubmit`
// (onAfterSubmit attendu, PUIS fermeture).
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: (props: {
    formId: string;
    title?: string;
    defaultValues?: unknown;
    hiddenFields?: readonly string[];
    elementId?: string;
    elementType?: string;
    onAfterSubmit?: () => void | Promise<void>;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="coform-modal">
      <span data-testid="coform-props">
        {JSON.stringify({
          formId: props.formId,
          title: props.title,
          defaultValues: props.defaultValues,
          hiddenFields: props.hiddenFields,
          elementId: props.elementId,
          elementType: props.elementType,
        })}
      </span>
      <button
        type="button"
        onClick={async () => {
          await props.onAfterSubmit?.();
          props.onOpenChange(false);
        }}
      >
        enregistrer le créneau
      </button>
    </div>
  ),
}));
vi.mock("@/modules/search/components/SwitchDetailsMode", () => ({
  SwitchDetailsMode: ({
    item,
    preview,
    setOpenDetails,
  }: {
    item: { id: string };
    preview?: unknown;
    setOpenDetails: (open: boolean) => void;
  }) => (
    <div>
      <div data-testid="detail">{`${item.id}:${JSON.stringify(preview)}`}</div>
      <button type="button" onClick={() => setOpenDetails(false)}>
        fermer le détail
      </button>
    </div>
  ),
}));

import StructuresTab from "./StructuresTab";
import type { StructuresTabProps } from "../../schema";

const PROPS: StructuresTabProps = {
  answers: { formId: FORM, structureFinderPath: FINDER_PATH },
  scope: "costum" as const,
  emptyAction: { label: { fr: "Référencer ma structure" }, href: "/structure" },
};

const org = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  serverData: { name, slug: name.toLowerCase().replace(/\s+/g, "-"), address: { addressLocality: "Saint-Pierre" }, ...extra },
});
/** `structures` : le finder APLATI par le hook (clé du finder à la racine), `{ <id>: { name } }`. */
const creneau = (id: string, title: string, state: string, structures?: Record<string, string>) => ({
  id,
  serverData: {
    ...(structures
      ? { [FINDER_KEY]: Object.fromEntries(Object.entries(structures).map(([sid, name]) => [sid, { id: sid, name, type: "organizations" }])) }
      : {}),
    [`${SECTION}mdegc9sgox76p87n27`]: title,
    [`${SECTION}mdn1cs8on3yru1p80lq`]: "Sport santé sur ordonnance - SSsO",
    [`${SECTION}mdn1jcq445i0mb9bap7`]: state,
    [`timeSlots${SECTION}mdefmehl5baa207uud6`]: [
      { day: "Monday", startHour: "9", startMinute: "00", endHour: "10", endMinute: "30" },
      { day: "Wednesday", startHour: "9", startMinute: "00", endHour: "10", endMinute: "30" },
    ],
  },
});

let queryClient: QueryClient;
function tab(props = PROPS) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profil/judi/structures"]}>
        <Routes>
          <Route path="/profil/judi/structures" element={<StructuresTab {...props} />} />
          <Route path="/structure" element={<p>page des structures</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
const renderTab = (props = PROPS) => render(tab(props));

beforeEach(() => {
  queryClient = new QueryClient();
  ctx.hydrated = true;
  ctx.orgs = [org(ORG_A, "Club Rando Santé")];
  ctx.orgsLoading = false;
  ctx.orgsError = null;
  ctx.orgsRefetch.mockClear();
  ctx.orgParams = undefined;
  ctx.answers = {
    [ORG_A]: { rows: [creneau("c1", "Marche nordique", ""), creneau("c2", "Gym douce", "Validé")] },
  };
  ctx.answersRefetch.mockClear();
  ctx.fetchNextPage.mockClear();
  ctx.searchCalls = [];
  ctx.toastSuccess.mockClear();
});

describe("StructuresTab — avant hydratation", () => {
  it("rend le titre et un squelette annoncé, sans interroger le serveur ni lister de structure", () => {
    ctx.hydrated = false;
    renderTab();
    expect(screen.getByRole("heading", { level: 2, name: "StructuresTab.title" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("StructuresTab.loading");
    expect(screen.queryByText("Club Rando Santé")).toBeNull();
    expect(ctx.orgParams?.enabled).toBe(false);
  });
});

describe("StructuresTab — liste des structures", () => {
  it("demande les structures où l'utilisateur est admin VALIDÉ, bornées au site porteur", () => {
    renderTab();
    expect(ctx.orgParams).toMatchObject({
      enabled: true,
      sourceKey: ["sportSanteBienetre"],
      filters: { "links.members.u1.isAdmin": true, "links.members.u1.isAdminPending": { $exists: false } },
    });
  });

  it("`scope: network` : pas de périmètre de site", () => {
    renderTab({ ...PROPS, scope: "network" as never });
    expect(ctx.orgParams?.sourceKey).toBeUndefined();
  });

  it("chargement : squelette annoncé", () => {
    ctx.orgsLoading = true;
    renderTab();
    expect(screen.getByRole("status").textContent).toContain("StructuresTab.loading");
  });

  it("échec : le dit, et « Réessayer » relance la requête", () => {
    ctx.orgsError = new Error("réseau");
    renderTab();
    expect(screen.getByRole("alert").textContent).toContain("StructuresTab.loadError");
    fireEvent.click(screen.getByRole("button", { name: "StructuresTab.retry" }));
    expect(ctx.orgsRefetch).toHaveBeenCalledTimes(1);
  });

  it("sans structure : dit comment en faire apparaître une, et y mène par un LIEN", async () => {
    ctx.orgs = [];
    renderTab();
    expect(screen.getByText("StructuresTab.emptyDescription")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Référencer ma structure" }));
    expect(await screen.findByText("page des structures")).toBeTruthy();
  });
});

describe("StructuresTab — créneaux d'une structure", () => {
  it("déplie la structure et liste ses créneaux : statut lisible (vide = en attente) et compteurs en en-tête", () => {
    renderTab();
    expect(screen.getByRole("heading", { level: 3, name: /Club Rando Santé/ })).toBeTruthy();
    const liste = screen.getByRole("list", { name: /StructuresTab\.slotsLabel/ });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(2);
    expect(within(liste).getByText("coformAnswer.status.pending")).toBeTruthy();
    expect(within(liste).getByText("coformAnswer.status.validated")).toBeTruthy();
    // Les jours, en texte, pour les lecteurs d'écran (la bande est purement visuelle).
    expect(within(liste).getAllByText(/StructuresTab\.weekDays/)[0].textContent).toContain("days.monday, days.wednesday");
    expect(screen.getByText(/StructuresTab\.counts\.pending\{"count":1\}/)).toBeTruthy();
    // La requête vise CETTE structure, $exists à true sur son finder, sous le préfixe du compte.
    const appel = ctx.searchCalls.find((c) => c.list === ORG_A && c.enabled);
    expect(appel?.prefix).toBe(PREFIX);
    expect(appel?.filters).toEqual({ form: FORM, [`${FINDER_PATH}.${ORG_A}`]: { $exists: true } });
    // L'auteur projeté dans TOUTES les listes : « Modifier » le reconnaît aussi sous une structure.
    expect(appel?.fields).toEqual(["user"]);
  });

  it("liste incomplète (page suivante) : un minimum, jamais des compteurs lus comme des totaux", () => {
    ctx.answers[ORG_A] = { rows: [creneau("c1", "Marche nordique", "Validé")], hasNextPage: true };
    renderTab();
    expect(screen.getByText(/StructuresTab\.summary\.partial\{"count":1\}/)).toBeTruthy();
    expect(screen.queryByText(/StructuresTab\.counts\./)).toBeNull();
  });

  it("chargement d'une structure : squelette, sans liste", () => {
    ctx.answers[ORG_A] = { loading: true };
    renderTab();
    expect(screen.queryByRole("list", { name: /StructuresTab\.slotsLabel/ })).toBeNull();
  });

  it("échec d'une structure : l'alerte la NOMME, et son « Réessayer » aussi", () => {
    ctx.answers[ORG_A] = { error: new Error("réseau") };
    renderTab();
    expect(screen.getByRole("alert").textContent).toContain('StructuresTab.slotsError{"structure":"Club Rando Santé"}');
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.retryFor{"structure":"Club Rando Santé"}' }));
    expect(ctx.answersRefetch).toHaveBeenCalledWith(ORG_A);
  });

  it("structure sans créneau : le dit et propose d'en ajouter un sur place", () => {
    ctx.answers[ORG_A] = { rows: [] };
    renderTab();
    expect(screen.getAllByText("StructuresTab.noSlots").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /StructuresTab\.addFor/ })).toHaveLength(2); // en-tête + état vide
  });

  it("au-delà de trois structures, seule la première est dépliée (les autres ne chargent rien)", () => {
    ctx.orgs = [org(ORG_A, "A"), org(ORG_B, "B"), org(ORG_C, "C"), org(ORG_D, "D")];
    renderTab();
    expect([...enabledLists()]).toEqual([ORG_A]);
  });

  it("le dépliage par défaut est figé : une page suivante ne replie pas les structures déjà ouvertes", () => {
    ctx.orgs = [org(ORG_A, "A"), org(ORG_B, "B")];
    const { rerender } = renderTab();
    ctx.orgs = [org(ORG_A, "A"), org(ORG_B, "B"), org(ORG_C, "C"), org(ORG_D, "D")];
    ctx.searchCalls = [];
    rerender(tab());
    expect(enabledLists()).toEqual(new Set([ORG_A, ORG_B]));
  });

  it("le clic sur un créneau ouvre son détail en LECTURE ; la ligne dit l'action", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.openSlot{"title":"Marche nordique"}' }));
    expect(screen.getByTestId("detail").textContent).toBe('c1:{"type":"coform-answer"}');
  });

  it("`answers.editButton` : le détail porte « Modifier » (le gate gestionnaire OU auteur est celui du détail)", () => {
    renderTab({ ...PROPS, answers: { ...PROPS.answers, editButton: true } });
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.openSlot{"title":"Marche nordique"}' }));
    expect(screen.getByTestId("detail").textContent).toBe('c1:{"type":"coform-answer","editButton":true}');
  });
});

describe("StructuresTab — ajouter un créneau depuis une structure", () => {
  it("ouvre le formulaire : structure préremplie ET masquée, brouillon rangé par structure, titre qui la nomme", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /StructuresTab\.addFor/ }));
    const props = JSON.parse((await screen.findByTestId("coform-props")).textContent ?? "{}");
    expect(props).toEqual({
      formId: FORM,
      title: 'StructuresTab.addTitle{"structure":"Club Rando Santé"}',
      defaultValues: { [SECTION]: { [FINDER_KEY]: { [ORG_A]: { id: ORG_A, type: "organizations", name: "Club Rando Santé" } } } },
      hiddenFields: [FINDER_KEY],
      elementId: ORG_A,
      elementType: "organizations",
    });
  });

  it("ajout depuis l'état vide : le focus revient au bouton « Ajouter » de l'EN-TÊTE (celui de l'état vide disparaîtra)", async () => {
    ctx.answers[ORG_A] = { rows: [] };
    renderTab();
    const [enTete, etatVide] = screen.getAllByRole("button", { name: /StructuresTab\.addFor/ });
    fireEvent.click(etatVide);
    fireEvent.click(await screen.findByText("enregistrer le créneau"));
    await waitFor(() => expect(document.activeElement).toBe(enTete));
  });

  it("l'enregistrement rafraîchit les listes du compte, déplie CETTE structure, et le dit", async () => {
    // Quatre structures : seule la première est dépliée ; on ajoute à la DEUXIÈME, repliée.
    ctx.orgs = [org(ORG_A, "A"), org(ORG_B, "B"), org(ORG_C, "C"), org(ORG_D, "D")];
    renderTab();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    expect(enabledLists().has(ORG_B)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.addFor{"structure":"B"}' }));
    fireEvent.click(await screen.findByText("enregistrer le créneau"));
    await waitFor(() => expect(ctx.toastSuccess).toHaveBeenCalledWith("StructuresTab.added"));
    // Le préfixe PARTAGÉ : seules les listes actives se rechargent (React Query), dont celle de B.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [PREFIX] });
    await waitFor(() => expect(enabledLists().has(ORG_B)).toBe(true));
    expect(screen.queryByTestId("coform-modal")).toBeNull();
  });
});

describe("StructuresTab — statut de modération d'une structure", () => {
  const AVEC_STATUT = { ...PROPS, structureStatusField: "statusActor" };

  it("hors « Validé » : pastille DANS le déclencheur (son mot fait partie du nom) et explication au dépliage", () => {
    ctx.orgs = [org(ORG_A, "Judi structure", { statusActor: "En cours" })];
    renderTab(AVEC_STATUT);
    expect(screen.getByRole("button", { name: /Judi structure.*StructuresTab\.structureStatus\.pending/ })).toBeTruthy();
    expect(screen.getByText("StructuresTab.structureStatusHelp.pending")).toBeTruthy();
  });

  it("« Refusé » (et la graphie legacy « Réfusé ») : pastille et explication du refus", () => {
    ctx.orgs = [org(ORG_A, "A", { statusActor: "Réfusé" })];
    renderTab(AVEC_STATUT);
    expect(screen.getByText("StructuresTab.structureStatus.refused")).toBeTruthy();
    expect(screen.getByText("StructuresTab.structureStatusHelp.refused")).toBeTruthy();
  });

  it("« Validé » : rien — l'exception seule est signalée", () => {
    ctx.orgs = [org(ORG_A, "A", { statusActor: "Validé" })];
    renderTab(AVEC_STATUT);
    expect(screen.queryByText(/StructuresTab\.structureStatus/)).toBeNull();
  });

  it("sans `structureStatusField` : rien, même sur une structure en attente (le champ peut dire autre chose ailleurs)", () => {
    ctx.orgs = [org(ORG_A, "A", { statusActor: "En cours" })];
    renderTab();
    expect(screen.queryByText(/StructuresTab\.structureStatus/)).toBeNull();
  });
});

describe("StructuresTab — créneaux déposés hors de ses structures", () => {
  const AVEC_DEPOSES = { ...PROPS, answers: { ...PROPS.answers, submittedSlots: true, editButton: true } };
  const deposes = () => ctx.searchCalls.filter((c) => c.list === SUBMITTED);

  it("option absente : aucune requête", () => {
    renderTab();
    expect(deposes()).toHaveLength(0);
  });

  it("requête bornée à l'auteur, sous le préfixe du compte, auteur PROJETÉ (gate « Modifier » de l'auteur)", () => {
    renderTab(AVEC_DEPOSES);
    const appel = deposes().find((c) => c.enabled);
    expect(appel?.prefix).toBe(PREFIX);
    expect(appel?.filters).toEqual({ form: FORM, user: "u1" });
    expect(appel?.fields).toEqual(["user"]);
  });

  it("une ligne à un seul endroit : les créneaux d'une structure listée sont écartés ; chaque autre ligne dit sa structure", () => {
    ctx.answers[SUBMITTED] = {
      rows: [
        creneau("d1", "Déjà rangé", "En attente", { [ORG_A]: "Club Rando Santé" }),
        creneau("d2", "TEST BASKET", "En cours"),
        creneau("d3", "Badming town", "Validé", { [ORG_TAMPON]: "MAIRIE DU TAMPON" }),
      ],
    };
    renderTab(AVEC_DEPOSES);
    const liste = screen.getByRole("list", { name: "StructuresTab.submitted.label" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(2);
    expect(within(liste).queryByText("Déjà rangé")).toBeNull();
    expect(within(liste).getByText("StructuresTab.submitted.noStructure")).toBeTruthy();
    expect(within(liste).getByText("MAIRIE DU TAMPON")).toBeTruthy();
    expect(within(liste).getByText('StructuresTab.submitted.structureSr{"structures":"MAIRIE DU TAMPON","count":1}')).toBeTruthy();
    // Tous statuts : l'« En cours » de l'auteur est là.
    expect(within(liste).getByText("coformAnswer.status.inProgress")).toBeTruthy();
    expect(screen.getByRole("button", { name: /StructuresTab\.submitted\.title/ })).toBeTruthy();
  });

  it("exclusion par TOUTES les structures citées : la structure listée citée en premier suffit", () => {
    ctx.answers[SUBMITTED] = {
      rows: [
        creneau("d4", "Co-porté", "Validé", { [ORG_A]: "Club Rando Santé", [ORG_TAMPON]: "MAIRIE DU TAMPON" }),
        creneau("d2", "TEST BASKET", "En cours"),
      ],
    };
    renderTab(AVEC_DEPOSES);
    const liste = screen.getByRole("list", { name: "StructuresTab.submitted.label" });
    expect(within(liste).queryByText("Co-porté")).toBeNull();
    expect(within(liste).getAllByRole("listitem")).toHaveLength(1);
  });

  it("nom absent du finder : celui de la structure jointe ; sans aucun nom : « Structure sans nom », pas « Sans structure »", () => {
    const sansNomFinder = (id: string, title: string, joint?: string) => ({
      id,
      serverData: {
        [FINDER_KEY]: { [ORG_TAMPON]: { id: ORG_TAMPON, type: "organizations" } },
        ...(joint ? { structure: { name: joint } } : {}),
        [`${SECTION}mdegc9sgox76p87n27`]: title,
        [`${SECTION}mdn1jcq445i0mb9bap7`]: "Validé",
      },
    });
    ctx.answers[SUBMITTED] = { rows: [sansNomFinder("d5", "Repli", "MAIRIE DU TAMPON"), sansNomFinder("d6", "Inconnue")] };
    renderTab(AVEC_DEPOSES);
    const liste = screen.getByRole("list", { name: "StructuresTab.submitted.label" });
    expect(within(liste).getByText("MAIRIE DU TAMPON")).toBeTruthy();
    expect(within(liste).getByText("StructuresTab.submitted.unnamedStructure")).toBeTruthy();
    expect(within(liste).queryByText("StructuresTab.submitted.noStructure")).toBeNull();
  });

  it("sans `answers.editButton` : le détail d'un créneau déposé reste en lecture", () => {
    ctx.answers[SUBMITTED] = { rows: [creneau("d2", "TEST BASKET", "En cours")] };
    renderTab({ ...PROPS, answers: { ...PROPS.answers, submittedSlots: true } });
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.openSlot{"title":"TEST BASKET"}' }));
    expect(screen.getByTestId("detail").textContent).toBe('d2:{"type":"coform-answer"}');
  });

  it("le créneau quitte le groupe au rechargement qui suit la fermeture du détail : le focus va au titre de l'onglet", async () => {
    ctx.answers[SUBMITTED] = { rows: [creneau("d2", "TEST BASKET", "En cours")] };
    const { rerender } = renderTab(AVEC_DEPOSES);
    const ligne = screen.getByRole("button", { name: 'StructuresTab.openSlot{"title":"TEST BASKET"}' });
    ligne.focus();
    fireEvent.click(ligne);
    fireEvent.click(screen.getByText("fermer le détail"));
    await waitFor(() => expect(document.activeElement).toBe(ligne));
    // Modifié depuis le détail, le créneau est passé sous une structure listée : le groupe se vide.
    ctx.answers[SUBMITTED] = { rows: [] };
    rerender(tab(AVEC_DEPOSES));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
  });

  it("le détail d'un créneau déposé s'ouvre modifiable", () => {
    ctx.answers[SUBMITTED] = { rows: [creneau("d2", "TEST BASKET", "En cours")] };
    renderTab(AVEC_DEPOSES);
    fireEvent.click(screen.getByRole("button", { name: 'StructuresTab.openSlot{"title":"TEST BASKET"}' }));
    expect(screen.getByTestId("detail").textContent).toBe('d2:{"type":"coform-answer","editButton":true}');
  });

  it("rien hors des structures listées : le groupe n'existe pas", () => {
    ctx.answers[SUBMITTED] = { rows: [creneau("d1", "Déjà rangé", "Validé", { [ORG_A]: "Club Rando Santé" })] };
    renderTab(AVEC_DEPOSES);
    expect(screen.queryByRole("list", { name: "StructuresTab.submitted.label" })).toBeNull();
    expect(screen.queryByText(/StructuresTab\.submitted\.title/)).toBeNull();
  });

  it("page entièrement écartée alors qu'une autre suit : la suivante est chargée avant de conclure", () => {
    ctx.answers[SUBMITTED] = { rows: [creneau("d1", "Déjà rangé", "Validé", { [ORG_A]: "A" })], hasNextPage: true };
    renderTab(AVEC_DEPOSES);
    expect(ctx.fetchNextPage).toHaveBeenCalledWith(SUBMITTED);
  });

  it("échec du chargement : la page suivante n'est PAS relancée en boucle", () => {
    ctx.answers[SUBMITTED] = {
      rows: [creneau("d1", "Déjà rangé", "Validé", { [ORG_A]: "A" })],
      hasNextPage: true,
      error: new Error("réseau"),
    };
    renderTab(AVEC_DEPOSES);
    expect(ctx.fetchNextPage).not.toHaveBeenCalled();
  });

  it("compte sans structure : l'état vide reste, le groupe s'appelle « Vos créneaux »", () => {
    ctx.orgs = [];
    ctx.answers[SUBMITTED] = { rows: [creneau("d2", "TEST BASKET", "En cours")] };
    renderTab(AVEC_DEPOSES);
    expect(screen.getByText("StructuresTab.emptyDescription")).toBeTruthy();
    expect(screen.getByRole("button", { name: /StructuresTab\.submitted\.titleAlone/ })).toBeTruthy();
    // « hors de vos structures » n'aurait pas de sens pour un compte qui n'en a aucune.
    expect(screen.getByRole("list", { name: "StructuresTab.submitted.labelAlone" })).toBeTruthy();
  });

  it("structures en chargement ou en erreur : pas de requête (l'exclusion a besoin de leurs ids)", () => {
    ctx.orgsLoading = true;
    renderTab(AVEC_DEPOSES);
    expect(deposes()).toHaveLength(0);
    ctx.orgsLoading = false;
    ctx.orgsError = new Error("réseau");
    renderTab(AVEC_DEPOSES);
    expect(deposes()).toHaveLength(0);
  });

  it("échec : le dit, et « Réessayer » relance CETTE liste", () => {
    ctx.answers[SUBMITTED] = { error: new Error("réseau") };
    renderTab(AVEC_DEPOSES);
    const alerte = screen.getAllByRole("alert").find((a) => a.textContent?.includes("StructuresTab.submitted.loadError"));
    expect(alerte).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "StructuresTab.submitted.retryFor" }));
    expect(ctx.answersRefetch).toHaveBeenCalledWith(SUBMITTED);
  });
});
