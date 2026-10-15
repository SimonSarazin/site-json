import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * `prefetchFilters` + `facetCache` : les facettes sont demandées au backend une fois par durée de
 * vie et par conteneur, pas une fois par rendu SSR. Chaque `QueryClient` ci-dessous est une requête
 * HTTP distincte (c'est ainsi qu'`entry-server` les crée) — le mémo, lui, est au niveau du
 * processus. On vérifie aussi ce qui NE doit PAS changer : la clé React Query et la donnée que la
 * page lira (`useSearchZoneQuery` & co.) sont celles d'avant, le cache est invisible du rendu.
 */
const target = {
  searchZone: vi.fn(),
  coformFiltersSearch: vi.fn(),
  searchCostum: vi.fn(),
  coformFilterByPath: vi.fn(),
};
vi.mock("@/lib/cocolightInitQuery", () => ({
  ensureInitApi: vi.fn(async () => ({ entity: target, api: null })),
}));

const fetchSearchZones = vi.fn();
const fetchFiltersByAnswers = vi.fn();
const fetchFilterEntities = vi.fn();
const fetchFiltersByPath = vi.fn();
vi.mock("../../hooks/useSearchZone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useSearchZone")>()),
  fetchSearchZones: (...args: unknown[]) => fetchSearchZones(...args),
}));
vi.mock("../../hooks/useFiltersByAnswers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useFiltersByAnswers")>()),
  fetchFiltersByAnswers: (...args: unknown[]) => fetchFiltersByAnswers(...args),
}));
vi.mock("../../hooks/useFilterEntities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useFilterEntities")>()),
  fetchFilterEntities: (...args: unknown[]) => fetchFilterEntities(...args),
}));
vi.mock("../../hooks/useFiltersByPath", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useFiltersByPath")>()),
  fetchFiltersByPath: (...args: unknown[]) => fetchFiltersByPath(...args),
}));

// Un mémo PROPRE au test : l'instance réelle lit `SSR_FACET_CACHE_TTL_MS` dans le shell du
// développeur (`0` = passe-plat), ce qui rendrait ces tests dépendants de l'environnement.
vi.mock("../facetCache", async () => {
  const { createSsrMemo } = await import("@/lib/ssrMemo");
  return { facetCache: createSsrMemo({ ttlMs: 60_000 }) };
});
import { facetCache } from "../facetCache";
import {
  prefetchSearchZones,
  prefetchFiltersByAnswers,
  prefetchFilterEntities,
  prefetchFiltersByPath,
} from "../prefetchFilters";
import { searchZoneQueryKey } from "../../hooks/useSearchZone";
import { filterEntitiesQueryKey, type FilterEntitiesOptions } from "../../hooks/useFilterEntities";

const ZONES = [{ name: "Bretagne", level: "3" }];
const ZONE_OPTIONS = { countryCode: ["FR", "BE"], level: ["3"] };

beforeEach(() => {
  facetCache.clear();
  vi.clearAllMocks();
  fetchSearchZones.mockResolvedValue(ZONES);
  fetchFiltersByAnswers.mockResolvedValue({ activités: { label: "Activités", values: [] } });
  fetchFilterEntities.mockResolvedValue([{ id: "1", name: "Réseau Bretagne" }]);
  fetchFiltersByPath.mockResolvedValue({ reseauxThematiques: { label: "Réseaux", values: [] } });
});

describe("prefetchFilters — cache serveur des facettes", () => {
  it("deux requêtes SSR (deux QueryClient) → UN appel backend, la même donnée dans chaque cache", async () => {
    const requeteA = new QueryClient();
    const requeteB = new QueryClient();

    const a = await prefetchSearchZones(requeteA, "filters-zone-lieux", ZONE_OPTIONS);
    const b = await prefetchSearchZones(requeteB, "filters-zone-lieux", ZONE_OPTIONS);

    expect(fetchSearchZones).toHaveBeenCalledTimes(1);
    expect(a).toEqual(ZONES);
    expect(b).toEqual(ZONES);
    // La page lira la MÊME clé qu'avant le cache (`useSearchZoneQuery`).
    const key = searchZoneQueryKey("filters-zone-lieux", ZONE_OPTIONS);
    expect(requeteA.getQueryData(key)).toEqual(ZONES);
    expect(requeteB.getQueryData(key)).toEqual(ZONES);
  });

  it("deux requêtes concurrentes partagent l'appel en vol", async () => {
    let resolve!: (v: unknown) => void;
    fetchSearchZones.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const pending = [
      prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS),
      prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS),
    ];
    // L'appel backend part après l'`await ensureInitApi` de chaque queryFn : on attend qu'il soit
    // parti (une fois, pas deux) avant de le résoudre.
    await vi.waitFor(() => expect(fetchSearchZones).toHaveBeenCalledTimes(1));
    resolve(ZONES);
    expect(await Promise.all(pending)).toEqual([ZONES, ZONES]);
  });

  it("chaque requête reçoit sa propre copie : muter l'une ne touche pas l'autre", async () => {
    const a = await prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS);
    (a as Array<{ name: string }>)[0].name = "MUTÉ";
    const b = await prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS);
    expect((b as Array<{ name: string }>)[0].name).toBe("Bretagne");
  });

  it("des options différentes sont des entrées différentes", async () => {
    await prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS);
    await prefetchSearchZones(new QueryClient(), "z", { countryCode: ["FR"], level: ["1"] });
    expect(fetchSearchZones).toHaveBeenCalledTimes(2);
  });

  it("un échec backend n'est pas mémorisé : le prefetch reste best-effort (null) et la suivante réessaie", async () => {
    fetchSearchZones.mockRejectedValueOnce(new Error("backend HS"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(await prefetchSearchZones(qc, "z", ZONE_OPTIONS)).toBeNull();
    expect(await prefetchSearchZones(new QueryClient(), "z", ZONE_OPTIONS)).toEqual(ZONES);
    expect(fetchSearchZones).toHaveBeenCalledTimes(2);
  });

  it("filtersByAnswers, entityList et filtersByPath sont mémorisés de la même façon", async () => {
    const answers = { activités: { id: "activites", label: { fr: "Activités" } } };
    const entities: FilterEntitiesOptions = { defaultTypes: ["organizations"], defaultFilters: { tags: ["RéseauTiersLieux"] } };
    const byPath = { reseauxThematiques: { label: { fr: "Réseaux" }, thematicPath: "form_1.q" } };

    for (const qc of [new QueryClient(), new QueryClient()]) {
      await prefetchFiltersByAnswers(qc, "answers", answers);
      await prefetchFilterEntities(qc, "entities", entities, "slug");
      await prefetchFiltersByPath(qc, "by-path", byPath);
    }
    expect(fetchFiltersByAnswers).toHaveBeenCalledTimes(1);
    expect(fetchFilterEntities).toHaveBeenCalledTimes(1);
    expect(fetchFiltersByPath).toHaveBeenCalledTimes(1);
  });

  it("entityList : `filterBy` distingue les entrées (il n'est pas dans la queryKey)", async () => {
    const entities: FilterEntitiesOptions = { defaultTypes: ["organizations"] };
    await prefetchFilterEntities(new QueryClient(), "e", entities, "slug");
    await prefetchFilterEntities(new QueryClient(), "e", entities, "id");
    expect(fetchFilterEntities).toHaveBeenCalledTimes(2);
    expect(fetchFilterEntities).toHaveBeenLastCalledWith(target, entities, "id");
    // …mais la clé React Query, elle, reste celle du client.
    expect(filterEntitiesQueryKey("e", entities)).toEqual(["filter-entities", "e", JSON.stringify(entities)]);
  });

  it("les garde-fous d'avant le cache tiennent : options vides → rien n'est demandé", async () => {
    expect(await prefetchSearchZones(new QueryClient(), "z", { countryCode: [], level: [] })).toBeNull();
    expect(await prefetchFiltersByAnswers(new QueryClient(), "a", {})).toBeNull();
    expect(await prefetchFilterEntities(new QueryClient(), "e", { defaultTypes: [] })).toBeNull();
    expect(await prefetchFiltersByPath(new QueryClient(), "p", {})).toBeNull();
    expect(fetchSearchZones).not.toHaveBeenCalled();
    expect(facetCache.size).toBe(0);
  });
});
