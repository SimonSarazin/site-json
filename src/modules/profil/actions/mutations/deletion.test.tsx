// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";

import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { useDeleteEvent } from "./deletion";

/**
 * Ce que garantit ce fichier : après suppression, la fiche de l'événement QUITTE le cache.
 *
 * Le piège est dans le SDK : `delete()` VIDE l'instance (`_markDeletedLocally`), si bien que tout
 * ce qui lit `entity.slug` après l'action lit `null` — une clé `["element-about", null]` ne vise
 * plus rien, et la fiche fantôme reste servie depuis le cache (retour arrière, lien interne).
 */

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: null }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: vi.fn(), showErrorToast: vi.fn() }));

const FICHE = PROFIL_QUERY_KEYS.ELEMENT_ABOUT("mon-event", null);

/** Doublure fidèle au SDK sur le seul point qui compte ici : après `delete()`, `slug` vaut `null`. */
function evenement(supprimer: () => Promise<void> = async () => {}) {
  let slug: string | null = "mon-event";
  return {
    getEntityType: () => "events",
    get slug() {
      return slug;
    },
    delete: vi.fn(async () => {
      await supprimer();
      slug = null;
    }),
  } as unknown as EntityTypes;
}

function monter(entity: EntityTypes) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(FICHE, { name: "Mon événement" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDeleteEvent(entity), { wrapper });
  return { client, result };
}

describe("useDeleteEvent — cache après suppression", () => {
  it("retire la fiche de l'événement supprimé, clé lue AVANT que le SDK ne vide l'instance", async () => {
    const { client, result } = monter(evenement());

    await act(() => result.current.mutateAsync());

    // `findAll` et non `find` : ce dernier compare en `exact` par défaut, et une clé préfixe n'y
    // matcherait jamais rien — le test passerait à vide.
    expect(client.getQueryCache().findAll({ queryKey: PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX("mon-event") })).toEqual([]);
  });

  it("la fiche encore affichée ne relance aucun fetch vers l'événement supprimé", async () => {
    // Ce que ferait une INVALIDATION : la requête de la page, toujours montée jusqu'à la
    // navigation, repartirait aussitôt vers `entityBySlug` — et un 404.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(FICHE, { name: "Mon événement" });
    const lireFiche = vi.fn(async () => ({ name: "Mon événement" }));
    const entity = evenement();

    function Fiche() {
      useQuery({ queryKey: FICHE, queryFn: lireFiche, staleTime: Infinity });
      return null;
    }
    function BoutonSupprimer() {
      const mutation = useDeleteEvent(entity);
      return <button onClick={() => mutation.mutate()}>{mutation.status}</button>;
    }
    render(
      <QueryClientProvider client={client}>
        <Fiche />
        <BoutonSupprimer />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button"));
    await screen.findByText("success");

    expect(lireFiche).not.toHaveBeenCalled();
  });

  it("un échec de suppression laisse la fiche en cache : la page reste utilisable", async () => {
    const { client, result } = monter(evenement(() => Promise.reject(new Error("403"))));

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow("403");
    });

    expect(client.getQueryData(FICHE)).toEqual({ name: "Mon événement" });
  });
});
