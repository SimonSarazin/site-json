import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * `ensureInitApi` : l'init API vue comme UNE entrée React Query par `QueryClient`.
 *
 * Côté serveur, un `QueryClient` = une requête HTTP. Avant ce helper, `entry-server` et chacun des
 * loaders de préchargement appelaient `initApi()` pour leur compte : sur tiers-lieux `/lieux`,
 * 6 `ApiClient` et 6 résolutions de l'entité porteuse (`getinfo/key` + `element/about`) par page
 * servie. Ces tests figent le contrat : N demandes sur le même client → UNE init ; un autre client
 * (une autre requête) → la sienne.
 */
const initApi = vi.fn();
vi.mock("@/lib/apiClient", () => ({ initApi: (...args: unknown[]) => initApi(...args) }));
vi.mock("@/lib/constant/common", () => ({ getBaseUrl: () => "http://backend.test" }));

import { COCOLIGHT_INIT_QUERY_KEY, ensureInitApi } from "../cocolightInitQuery";

const RESULT = { client: { id: "client" }, api: { id: "api" }, entity: null, me: null };

describe("ensureInitApi — une init API par QueryClient", () => {
  beforeEach(() => {
    initApi.mockReset();
  });

  it("des appels CONCURRENTS sur le même queryClient partagent UNE seule init", async () => {
    let resolve!: (value: unknown) => void;
    initApi.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const queryClient = new QueryClient();

    // Trois loaders qui démarrent en parallèle (Promise.all dans buildRoutes) : la 1re demande
    // lance la requête, les deux autres attendent la MÊME promesse — rien n'est relancé.
    const pending = [ensureInitApi(queryClient), ensureInitApi(queryClient), ensureInitApi(queryClient)];
    expect(initApi).toHaveBeenCalledTimes(1);
    expect(initApi).toHaveBeenCalledWith({ baseURL: "http://backend.test" });

    resolve(RESULT);
    const results = await Promise.all(pending);
    expect(initApi).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r).toBe(RESULT);
  });

  it("un appel SÉQUENTIEL (entry-server après les loaders) retrouve l'init sans la relancer", async () => {
    initApi.mockResolvedValue(RESULT);
    const queryClient = new QueryClient();

    await ensureInitApi(queryClient);
    const again = await ensureInitApi(queryClient);

    expect(initApi).toHaveBeenCalledTimes(1);
    expect(again).toBe(RESULT);
    expect(queryClient.getQueryData(COCOLIGHT_INIT_QUERY_KEY)).toBe(RESULT);
  });

  it("un AUTRE queryClient (= une autre requête SSR) refait SA propre init — isolation intacte", async () => {
    initApi.mockResolvedValue(RESULT);
    const requeteA = new QueryClient();
    const requeteB = new QueryClient();

    await ensureInitApi(requeteA);
    await ensureInitApi(requeteB);

    expect(initApi).toHaveBeenCalledTimes(2);
  });

  it("un échec d'init n'est pas mémorisé : la demande suivante de la requête réessaie (comme avant le partage)", async () => {
    initApi.mockRejectedValueOnce(new Error("token storage HS")).mockResolvedValue(RESULT);
    // `retry: false` : l'échec doit être VU, pas rattrapé par les tentatives de React Query.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await expect(ensureInitApi(queryClient)).rejects.toThrow("token storage HS");
    expect(await ensureInitApi(queryClient)).toBe(RESULT);
    expect(initApi).toHaveBeenCalledTimes(2);
  });

  it("la clé est celle qu'`entry-server` exclut de la déshydratation", () => {
    // `shouldDehydrateQuery: q => q.queryKey[0] !== COCOLIGHT_INIT_QUERY_KEY[0]` : l'entrée porte
    // des instances du SDK, pas du JSON — elle ne doit jamais partir vers le client.
    expect(COCOLIGHT_INIT_QUERY_KEY).toEqual(["cocolight-init"]);
  });
});
