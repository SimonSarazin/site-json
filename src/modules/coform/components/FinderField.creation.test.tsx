// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteContext } from "@/contexts/SiteContext";
import { organisationSdk } from "../__fixtures__/organisationSdk";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import type { FormFieldMapping } from "../types";

/**
 * Le parcours « Ajouter » d'un finder, de la saisie à la fermeture — champ, modale de recherche et
 * recherche RÉELS. Seules frontières : le serveur (`searchCostum`) et la modale de création, dont le
 * formulaire est testé à part.
 *
 * Ce que ce parcours tient, et que les tests de la modale seule (recherche doublée) ne voient pas :
 * la création retire du cache les recherches périmées SANS en relancer une — la modale, encore montée
 * au moment du retrait, ne doit pas recréer sa requête pour la jeter en se fermant.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const searchCostum = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: { searchCostum }, helper: { fromEntityJSON: (item: unknown) => item } }),
  useCocolightOptional: () => null,
}));

const creation = vi.hoisted(() => ({ creee: null as unknown }));
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({
  // Comme `EntityFormModal` : la modale de création se ferme, PUIS rend l'entité créée.
  DynamicModal: (props: { onOpenChange: (open: boolean) => void; onCreated?: (e: unknown) => void }) => (
    <button
      type="button"
      onClick={() => {
        props.onOpenChange(false);
        props.onCreated?.(creation.creee);
      }}
    >
      enregistrer la création
    </button>
  ),
}));

const { FinderField } = await import("./FinderField");

const CHAMP = {
  name: "finderaapStep1partenaires",
  label: "Partenaires du commun",
  componentType: "finder",
  finderConfig: { type: "organizations", addNew: true, elementLabel: "CAE", multiple: true, notSourceKey: true },
} as unknown as FormFieldMapping;

const CREEE_ID = "6a0000000000000000000001";
/** Le temps du debounce de la recherche (300 ms), et de quoi laisser partir une requête de trop. */
const APRES_DEBOUNCE_MS = 450;

beforeEach(async () => {
  searchCostum.mockReset();
  searchCostum.mockResolvedValue({ results: [] });
  creation.creee = await organisationSdk({ id: CREEE_ID, name: "Nouvelle CAE", type: "Cooperative" });
});

describe("FinderField — « Ajouter », de la saisie à la fermeture", () => {
  it("range l'élément créé, ferme la modale, et ne relance aucune recherche", async () => {
    const onChange = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Une recherche de PERSONNES gardée en cache (un autre finder du formulaire) : elle doit y rester.
    const personnes = COFORM_QUERY_KEYS.FINDER_SEARCH(["citoyens"], "Nouvelle", undefined, true);
    queryClient.setQueryData(personnes, []);
    const site = { config: {}, setConfig: () => {} };
    render(
      <QueryClientProvider client={queryClient}>
        <SiteContext.Provider value={site as never}>
          <FinderField field={CHAMP} errors={{}} value={null} onChange={onChange} />
        </SiteContext.Provider>
      </QueryClientProvider>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Partenaires du commun/ }));
    await user.type(screen.getByRole("textbox"), "Nouvelle CAE");

    // La vraie recherche répond « rien » : « Ajouter » est proposé.
    await user.click(await screen.findByRole("button", { name: "coform.finder.modal.addNewButton" }));
    // Compté ICI, pas supposé à 1 : sous charge, la frappe peut déborder le debounce et lancer une
    // recherche intermédiaire — ce qui compte est qu'aucune ne parte APRÈS la création.
    const avantCreation = searchCostum.mock.calls.length;
    expect(avantCreation).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "enregistrer la création" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith({
      [CREEE_ID]: expect.objectContaining({ id: CREEE_ID, name: "Nouvelle CAE", type: "organizations" }),
    });

    // La recherche d'organisations est sortie du cache, celle de personnes y est restée…
    const restantes = queryClient.getQueryCache().findAll({ queryKey: COFORM_QUERY_KEYS.FINDER_SEARCH_PREFIX() });
    expect(restantes.map((q) => q.queryKey)).toEqual([personnes]);
    // … et rien n'est reparti vers le serveur, ni au retrait ni à la fermeture.
    await new Promise((r) => setTimeout(r, APRES_DEBOUNCE_MS));
    expect(searchCostum).toHaveBeenCalledTimes(avantCreation);
    expect(queryClient.isFetching()).toBe(0);
  });
});
