// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Le hook décide QUAND une requête part et CE QU'elle demande. Chaque valeur stabilisée coûte un
 * aller-retour complet (la lib n'annule rien) : sous le seuil rien ne doit partir, et le code
 * postal ne doit jamais entrer dans la requête — il reclasse ce qui est déjà en cache.
 */
const ctx = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], results: [] as unknown[], isLoading: false, error: null as unknown }));
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: (params: Record<string, unknown>) => {
    ctx.calls.push(params);
    return { transformedResults: ctx.results, isLoading: ctx.isLoading, error: ctx.error };
  },
}));
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: <T,>(v: T) => v }));

import { useEntityDuplicates } from "./useEntityDuplicates";
import type { DuplicateBaseParams } from "../lib/duplicateSearch";

const ent = (id: string, name: string, postalCode?: string) =>
  ({ id, slug: id, serverData: { name, address: { postalCode, addressLocality: "X" } } }) as unknown as SearchEntity;
const baseParams: DuplicateBaseParams = { defaultTypes: ["organizations"], defaultFields: ["name"], searchBy: ["name"], indexStepList: 50, notSourceKey: true };
const last = () => ctx.calls[ctx.calls.length - 1];

beforeEach(() => {
  ctx.calls = [];
  ctx.results = [ent("p1", "La Plume d'or", "75011"), ent("p2", "La Plume à Loup", "62170")];
  ctx.isLoading = false;
  ctx.error = null;
});

describe("useEntityDuplicates", () => {
  it("sous le seuil : aucune requête (enabled false, searchType null, terme vide)", () => {
    const { result } = renderHook(() => useEntityDuplicates({ name: "La", baseParams, active: true }));
    expect(last()).toMatchObject({ enabled: false, searchType: null, searchText: "" });
    expect(result.current).toMatchObject({ matches: [], found: 0, isSearched: false, isLoading: false });
  });

  it("au seuil : terme NETTOYÉ (pas replié), searchType explicite, préfixe centralisé, pas de variant", () => {
    renderHook(() => useEntityDuplicates({ name: "L’Archipel", baseParams, active: true }));
    expect(last()).toMatchObject({
      enabled: true,
      searchText: "L Archipel",
      searchType: { type: ["organizations"] },
      queryKeyPrefix: "entityDuplicates",
      baseParams,
    });
    expect(last()).not.toHaveProperty("variant");
  });

  it("le code postal reclasse sans changer la requête", () => {
    const sans = renderHook(() => useEntityDuplicates({ name: "la plume a loup", baseParams, active: true }));
    const requeteSans = { ...last() };
    expect(sans.result.current.matches.map((m) => `${m.candidate.id}:${m.level}`)).toEqual(["p2:likely", "p1:possible"]);

    const avec = renderHook(() => useEntityDuplicates({ name: "la plume a loup", postalCode: "62170", baseParams, active: true }));
    expect(avec.result.current.matches[0]).toMatchObject({ level: "strong", candidate: { id: "p2" } });
    expect({ ...last() }).toEqual(requeteSans);
  });

  it("borne l'affichage à `limit` mais annonce le total trouvé", () => {
    const { result } = renderHook(() => useEntityDuplicates({ name: "plume", baseParams, active: true, limit: 1 }));
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.found).toBe(2);
  });

  it("inactif ou périmètre introuvable : rien ne part", () => {
    renderHook(() => useEntityDuplicates({ name: "La Plume", baseParams, active: false }));
    expect(last()).toMatchObject({ enabled: false, searchType: null });
    renderHook(() => useEntityDuplicates({ name: "La Plume", baseParams: null, active: true }));
    expect(last()).toMatchObject({ enabled: false, searchType: null });
  });

  it("pendant le chargement d'un NOUVEAU nom, garde les derniers résultats reçus (le panneau ne clignote pas)", () => {
    const { result, rerender } = renderHook(({ name }) => useEntityDuplicates({ name, baseParams, active: true }), { initialProps: { name: "La Plume" } });
    expect(result.current.matches).toHaveLength(2);
    // Nouveau nom → nouvelle clé de cache : la requête charge et n'a encore rien renvoyé.
    ctx.isLoading = true;
    ctx.results = [];
    rerender({ name: "La Plume à" });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.matches.map((m) => m.candidate.id)).toEqual(["p1", "p2"]);
    // Réponse reçue : elle remplace les résultats gardés, même vide.
    ctx.isLoading = false;
    rerender({ name: "La Plume à" });
    expect(result.current.matches).toHaveLength(0);
  });

  it("fraîcheur de cache allongée : le remontage du slot à l'étape suivante ne relance pas la requête", () => {
    renderHook(() => useEntityDuplicates({ name: "La Plume", baseParams, active: true }));
    expect(last()).toMatchObject({ cache: { staleTime: 5 * 60 * 1000 } });
  });

  it("remonte l'erreur de recherche sans inventer de correspondances", () => {
    ctx.error = new Error("réseau");
    ctx.results = [];
    const { result } = renderHook(() => useEntityDuplicates({ name: "La Plume", baseParams, active: true }));
    expect(result.current).toMatchObject({ isError: true, matches: [] });
  });
});
