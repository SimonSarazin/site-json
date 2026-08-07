// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCostumListValues } from "../useCostumListValues";

/**
 * Le contrat du hook tient en une phrase : **on ne demande au serveur que ce qu'on n'a pas déjà**.
 *
 * Une liste statique porte ses valeurs dans sa déclaration, et le moteur de formulaire les livre déjà au
 * champ par son chemin ordinaire (`listsOptions` → `options`) : le hook n'est alors pas sollicité, et
 * l'endpoint refuserait de toute façon. Une liste dynamique n'est qu'une recette, que seul le serveur
 * peut résoudre. Ces tests vérifient donc autant le résultat que L'ABSENCE D'APPEL, qui est la moitié du
 * point — c'est `TagsFromListField` qui décide, en coupant `enabled` dès qu'il a des propositions.
 */
const costumListValues = vi.fn();
let carrier: unknown = null;

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: { endpointApi: { costumListValues } }, entity: carrier }),
}));

const porteur = (lists: Record<string, unknown>) => ({ serverData: { slug: "institutBleu", costum: { lists } } });

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const rendu = (list: string, options?: { enabled?: boolean }) =>
  renderHook(() => useCostumListValues("institutBleu", list, options), { wrapper });

describe("useCostumListValues — n'interroge que ce qu'il faut", () => {
  beforeEach(() => {
    costumListValues.mockReset();
    carrier = null;
  });

  it("`enabled:false` — aucune requête : les propositions sont déjà connues", () => {
    // Cas réel : institutBleu/territoires, 64 valeurs figées dans la déclaration, livrées au champ par
    // `listsOptions`. Le widget coupe alors la query plutôt que de redemander ce qu'il a en main.
    carrier = porteur({ territoires: ["Saint-Denis", "Le Port"] });
    const { result } = rendu("territoires", { enabled: false });
    expect(result.current.data).toBeUndefined();
    expect(costumListValues).not.toHaveBeenCalled();
  });
});

describe("useCostumListValues — liste DYNAMIQUE", () => {
  beforeEach(() => {
    costumListValues.mockReset();
    carrier = null;
  });

  it("interroge le serveur : la déclaration n'est qu'une recette", async () => {
    carrier = porteur({ operatingLocation: { collection: "organizations", distinct: "operatingLocation" } });
    costumListValues.mockResolvedValue({ result: true, values: ["Le Port", "Saint-Paul"], count: 2 });

    const { result } = rendu("operatingLocation");
    await waitFor(() => expect(result.current.data?.values).toEqual(["Le Port", "Saint-Paul"]));
    expect(costumListValues).toHaveBeenCalledWith({ slug: "institutBleu", list: "operatingLocation" });
  });

  it("interroge aussi quand la déclaration est ABSENTE du costum en mémoire", async () => {
    // Les costums « moteur » vivent dans la collection `costum`, hors de l'entité porteuse : le front
    // n'a ni la déclaration ni les options, et c'est au serveur de trancher.
    carrier = porteur({});
    costumListValues.mockResolvedValue({ result: true, values: ["CTE"], count: 1 });

    const { result } = rendu("dispositif");
    await waitFor(() => expect(result.current.data?.values).toEqual(["CTE"]));
    expect(costumListValues).toHaveBeenCalled();
  });

  it("un refus serveur laisse une liste vide — le champ retombe sur la saisie libre", async () => {
    carrier = porteur({ x: { collection: "organizations", distinct: "email" } });
    costumListValues.mockResolvedValue({ result: false, msg: "champ non exposable" });

    const { result } = rendu("x");
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.values).toEqual([]);
  });

  it("une panne réseau ne casse pas le champ non plus", async () => {
    carrier = porteur({ x: { type: "badges", category: "cteR" } });
    costumListValues.mockRejectedValue(new Error("réseau"));

    const { result } = rendu("x");
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.values).toEqual([]);
  });

  it("remonte les VARIANTES d'écriture, pour que le filtre interroge tout le groupe", async () => {
    // Afficher une seule graphie convient à la saisie ; filtrer sur elle seule laisserait de côté les
    // fiches écrites autrement. Mesuré sur institutBleu : « baleines » seul rend 2 organisations,
    // le groupe { Baleines, baleines } en rend 3.
    carrier = porteur({ tags: { collection: "organizations", distinct: "tags" } });
    costumListValues.mockResolvedValue({
      result: true, values: ["baleines"], count: 1,
      variants: { baleines: ["Baleines", "baleines"] },
    });

    const { result } = rendu("tags");
    await waitFor(() => expect(result.current.data?.values).toEqual(["baleines"]));
    expect(result.current.data?.variants).toEqual({ baleines: ["Baleines", "baleines"] });
  });

  it("sans doublon d'écriture, `variants` est vide — rien à élargir", async () => {
    carrier = porteur({ x: { collection: "poi", distinct: "territoires" } });
    costumListValues.mockResolvedValue({ result: true, values: ["madagascar"], count: 1 });

    const { result } = rendu("x");
    await waitFor(() => expect(result.current.data?.values).toEqual(["madagascar"]));
    expect(result.current.data?.variants).toEqual({});
  });
});
