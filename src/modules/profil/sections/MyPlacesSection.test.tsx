// @vitest-environment jsdom
/**
 * « Mes lieux » : les organisations dont le compte est MEMBRE (pas suivies), et les 3 onglets qui
 * s'en dérivent (news/agenda/projets, chacun gaté sur les ids/slugs de l'onglet « lieux »). Ce que
 * ce test verrouille : la donnée de base est la bonne (adhésion, pas suivi — la confusion corrigée
 * après relecture du legacy), et les onglets dérivés ne partent PAS tant qu'aucun lieu n'est connu.
 *
 * ⚠ Un 5e onglet (« Lieux similaires ») existe côté code (`useSimilarPlacesQuery.ts`, testé à part)
 * mais est retiré de l'UI depuis le 29/09 (décision produit) — pas de mock/test ici pour lui tant
 * qu'il n'est pas remonté dans `MyPlacesSection.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { EntityTypes, Organization } from "@communecter/cocolight-api-client";

let me: EntityTypes | null = null;
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me }) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: null }) }));

interface EtatListe {
  organizations?: Organization[];
  items?: EntityTypes[];
  totalCount: number;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  lastItemRef: () => void;
  error: null;
  refetch: () => Promise<void>;
}

const REPOS: EtatListe = {
  totalCount: 0,
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  lastItemRef: () => {},
  error: null,
  refetch: async () => {},
};

let mesLieuxState: EtatListe;
const useUserOrganizations = vi.fn((..._args: unknown[]) => mesLieuxState);
vi.mock("../hooks/useMembershipQuery", () => ({
  useUserOrganizations: (a: unknown, b: unknown) => useUserOrganizations(a, b),
}));

let derivesState: EtatListe;
const useLinkedEntitiesQuery = vi.fn((..._args: unknown[]) => derivesState);
vi.mock("../hooks/useLinkedEntitiesQuery", () => ({
  useLinkedEntitiesQuery: (a: unknown) => useLinkedEntitiesQuery(a),
  buildLinkedEntitiesFilter: () => ({}),
}));

const useMemberNewsQuery = vi.fn((..._args: unknown[]) => ({ data: [] as EntityTypes[], isLoading: false }));
vi.mock("../hooks/useMemberNewsQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks/useMemberNewsQuery")>()),
  useMemberNewsQuery: (a: unknown, b: unknown) => useMemberNewsQuery(a, b),
}));

// `NewsItem` (rendu réel du module `news`, riche : commentaires/réactions/media) est ISOLÉ ici — ce
// test verrouille QUE MyPlacesSection lui passe la bonne organisation, pas le rendu interne de
// NewsItem lui-même (déjà couvert par les tests du module `news`).
vi.mock("@/modules/news/components/NewsItem", () => ({
  NewsItem: ({ item, entity }: { item: { id: string }; entity?: { slug?: string } }) => (
    <div data-testid={`news-item-${item.id}`} data-entity-slug={entity?.slug ?? "aucune"} />
  ),
}));

// `SearchListView` (moteur carte+aperçu du module `search`, lazy/Suspense, déjà testé ailleurs) est
// ISOLÉ ici — ce test verrouille QUE MyPlacesSection lui passe le bon `list.linkedLabels` (le lieu
// membre à afficher sur chaque carte Agenda/Projets), pas le rendu réel de la carte.
vi.mock("@/modules/search/components/SearchListView", () => ({
  default: ({ results, list }: { results: { id?: string }[]; list?: { linkedLabels?: Record<string, string> } }) => (
    <div data-testid="search-list-view">
      {results.map((r) => (
        <div key={r.id} data-testid={`item-${r.id}`} data-linked-label={list?.linkedLabels?.[r.id ?? ""] ?? ""} />
      ))}
    </div>
  ),
}));

import MyPlacesSection from "./MyPlacesSection";

function poser(props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <LocalizationProvider>
        <MyPlacesSection props={props} />
      </LocalizationProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  me = null;
  mesLieuxState = { ...REPOS, organizations: [] };
  derivesState = { ...REPOS, items: [] };
  useUserOrganizations.mockClear();
  useLinkedEntitiesQuery.mockClear();
  useMemberNewsQuery.mockClear();
});

describe("MyPlacesSection — anonyme", () => {
  it("invite à se connecter, sans interroger le SDK", () => {
    poser();
    expect(screen.getByText(/Connectez-vous/i)).toBeDefined();
    expect(useUserOrganizations).toHaveBeenCalledWith(null, expect.objectContaining({ enabled: false }));
  });
});

describe("MyPlacesSection — connecté, sur l'onglet « Mes tiers-lieux »", () => {
  beforeEach(() => {
    me = { slug: "moi" } as unknown as EntityTypes;
  });

  it("lit l'ADHÉSION (useUserOrganizations), pas un suivi", () => {
    poser();
    expect(useUserOrganizations).toHaveBeenCalledWith(me, expect.objectContaining({ enabled: true }));
  });

  it("relaie le `sourceKey` de config au hook d'adhésion", () => {
    const sourceKey = ["franceTierslieux", "tierslieuxbelgique", "navigatorDesTierslieux"];
    poser({ sourceKey });
    expect(useUserOrganizations).toHaveBeenCalledWith(me, expect.objectContaining({ sourceKey }));
  });

  it("sans aucune adhésion, l'état vide dit « membre », pas « suivi »", () => {
    poser();
    expect(screen.getByText(/n'êtes membre d'aucun tiers-lieu/i)).toBeDefined();
  });

  it("une organisation membre devient une carte, liée à sa fiche", () => {
    mesLieuxState = {
      ...REPOS,
      organizations: [{ id: "1", slug: "la-plume-a-loup", getEntityType: () => "organizations", serverData: { name: "La Plume à Loup" } } as unknown as Organization],
    };
    poser();
    const lien = screen.getByRole("link", { name: /La Plume à Loup/i });
    expect(lien.getAttribute("href")).toBe("/profil/la-plume-a-loup");
  });
});

describe("MyPlacesSection — onglets dérivés (news / agenda / projets)", () => {
  beforeEach(() => {
    me = { slug: "moi" } as unknown as EntityTypes;
  });

  it("tant qu'aucun lieu n'est connu, chaque onglet dérivé invite à en rejoindre un — sans réseau", async () => {
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Agenda/i }));
    expect(screen.getByText(/Rejoignez d'abord/i)).toBeDefined();
  });

  it("une fois des lieux connus, l'onglet Agenda est demandé activé, les autres pas encore", async () => {
    mesLieuxState = {
      ...REPOS,
      organizations: [{ id: "org-1", slug: "la-plume-a-loup" } as unknown as Organization],
    };
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Agenda/i }));

    // Le hook est appelé 2× PAR RENDU (agenda/projets — News est passé sur `useMemberNewsQuery`) :
    // on lit le DERNIER appel de chaque searchType, celui qui reflète le rendu consécutif au clic.
    const appels = useLinkedEntitiesQuery.mock.calls as Array<[{ searchType: string; enabled: boolean; cacheKey: string[] }]>;
    const inverses = [...appels].reverse();
    const agenda = inverses.find(([p]) => p.searchType === "events")![0];
    expect(agenda.enabled).toBe(true);
    expect(agenda.cacheKey).toEqual(["org-1"]);

    // `useMemberNewsQuery` — même gating, mais sur l'onglet News, jamais ouvert dans ce test.
    const appelsNews = useMemberNewsQuery.mock.calls;
    const dernierAppelNews = appelsNews[appelsNews.length - 1] as [unknown, { enabled: boolean }];
    expect(dernierAppelNews[1].enabled).toBe(false);
  });

  it("l'onglet « Lieux similaires » n'est plus proposé (retiré de l'UI le 29/09)", () => {
    poser();
    expect(screen.queryByRole("tab", { name: /Similaires/i })).toBeNull();
  });
});

describe("MyPlacesSection — onglets Agenda/Projets : la carte porte le lieu membre lié", () => {
  beforeEach(() => {
    me = { slug: "moi" } as unknown as EntityTypes;
    mesLieuxState = {
      ...REPOS,
      organizations: [{ id: "org-1", slug: "la-plume-a-loup", serverData: { name: "La Plume à Loup" } } as unknown as Organization],
    };
  });

  it("Agenda : le tiers-lieu ORGANISATEUR de l'événement (links.organizer), pas les participants", async () => {
    derivesState = {
      ...REPOS,
      items: [{ id: "evt-1", serverData: { id: "evt-1", startDate: "2099-01-01T10:00:00Z", links: { organizer: { "org-1": true }, attendees: { "org-2": true } } } } as unknown as EntityTypes],
    };
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Agenda/i }));

    expect(screen.getByTestId("item-evt-1").dataset.linkedLabel).toBe("La Plume à Loup");
  });

  it("Projets : le tiers-lieu contributeur (links.contributors)", async () => {
    derivesState = {
      ...REPOS,
      items: [{ id: "proj-1", serverData: { id: "proj-1", links: { contributors: { "org-1": true } } } } as unknown as EntityTypes],
    };
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Projets/i }));

    expect(screen.getByTestId("item-proj-1").dataset.linkedLabel).toBe("La Plume à Loup");
  });

  it("un item lié à aucun de mes lieux (autre organisateur) n'a pas de libellé", async () => {
    derivesState = {
      ...REPOS,
      items: [{ id: "evt-2", serverData: { id: "evt-2", startDate: "2099-01-01T10:00:00Z", links: { organizer: { "org-inconnu": true } } } } as unknown as EntityTypes],
    };
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Agenda/i }));

    expect(screen.getByTestId("item-evt-2").dataset.linkedLabel).toBe("");
  });
});

describe("MyPlacesSection — onglet Agenda : sous-onglets À venir/En cours/Passés (comme le composant Agenda)", () => {
  beforeEach(() => {
    me = { slug: "moi" } as unknown as EntityTypes;
    mesLieuxState = {
      ...REPOS,
      organizations: [{ id: "org-1", slug: "la-plume-a-loup", serverData: { name: "La Plume à Loup" } } as unknown as Organization],
    };
    derivesState = {
      ...REPOS,
      items: [
        { id: "evt-futur", serverData: { id: "evt-futur", startDate: "2099-01-01T10:00:00Z" } } as unknown as EntityTypes,
        { id: "evt-passe", serverData: { id: "evt-passe", startDate: "2000-01-01T10:00:00Z", endDate: "2000-01-01T18:00:00Z" } } as unknown as EntityTypes,
      ],
    };
  });

  it("affiche « À venir » par défaut — le passé n'y apparaît pas", async () => {
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /^Agenda$/i }));

    expect(screen.getByTestId("item-evt-futur")).toBeDefined();
    expect(screen.queryByTestId("item-evt-passe")).toBeNull();
  });

  it("l'onglet « Passés » montre l'événement passé, pas le futur", async () => {
    poser();
    await userEvent.click(screen.getByRole("tab", { name: /^Agenda$/i }));
    await userEvent.click(screen.getByRole("tab", { name: /Passés/i }));

    expect(screen.getByTestId("item-evt-passe")).toBeDefined();
    expect(screen.queryByTestId("item-evt-futur")).toBeNull();
  });
});

describe("MyPlacesSection — onglet News : chaque actu porte SON organisation, pas une au hasard", () => {
  beforeEach(() => {
    me = { slug: "moi" } as unknown as EntityTypes;
  });

  it("une actu de chaque lieu est rendue via NewsItem, scopée à sa propre organisation", async () => {
    // Le lieu est porté DÈS le fetch (`ActuDeLieu`), pas reconstruit après coup par `source.key` —
    // c'est la correction du bug « page blanche » : plus de cas « aucune correspondance » possible.
    const lieuA = { id: "id-a", slug: "la-plume-a-loup", getEntityType: () => "organizations" } as unknown as Organization;
    const lieuB = { id: "id-b", slug: "kiltir-lab", getEntityType: () => "organizations" } as unknown as Organization;
    mesLieuxState = { ...REPOS, organizations: [lieuA, lieuB] };
    useMemberNewsQuery.mockReturnValue({
      isLoading: false,
      data: [
        { news: { id: "n1" }, lieu: lieuA },
        { news: { id: "n2" }, lieu: lieuB },
      ] as unknown as EntityTypes[],
    });

    poser();
    await userEvent.click(screen.getByRole("tab", { name: /Actus/i }));

    expect(screen.getByTestId("news-item-n1").dataset.entitySlug).toBe("la-plume-a-loup");
    expect(screen.getByTestId("news-item-n2").dataset.entitySlug).toBe("kiltir-lab");
  });
});

