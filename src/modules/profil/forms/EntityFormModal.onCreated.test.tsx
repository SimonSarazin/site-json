// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * `onCreated` : une création lancée depuis un AUTRE parcours (le « Ajouter » d'un finder coform) rend
 * l'entité créée à l'appelant, et ne redirige PAS vers sa fiche — sinon le dépôt en cours serait
 * abandonné. Sans `onCreated`, la redirection vers la fiche reste la règle.
 *
 * Le VRAI `useEntityMutation` (c'est lui qui porte la règle de navigation) et la vraie config
 * d'organisation standard. Seuls le rendu du formulaire (`GenericForm`), le SDK (création sur `me`) et
 * la navigation sont des doublures — ce sont des frontières, pas la règle testée.
 */

const etat = vi.hoisted(() => ({
  navigate: vi.fn(),
  creations: [] as Array<Record<string, unknown>>,
}));

// Le SDK : `me.organization(payload)` rend l'entité créée, sauvegardable, avec son slug.
const CREEE = { id: "6a0000000000000000000001", slug: "nouvelle-cae", serverData: {} as Record<string, unknown>, save: async () => {} };
const ME = {
  slug: "moi",
  organization: async (payload: Record<string, unknown>) => {
    etat.creations.push(payload);
    return CREEE;
  },
};

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => etat.navigate,
}));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ME, entity: null }) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (k: unknown) => (typeof k === "string" ? k : (k as { fr: string }).fr),
}));
vi.mock("@/modules/formEngine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/formEngine")>()),
  GenericForm: ({ onSubmit }: { onSubmit: (v: Record<string, unknown>) => Promise<void> }) => (
    <button type="button" onClick={() => void onSubmit({ name: "Nouvelle CAE" })}>
      soumettre
    </button>
  ),
}));

const { EntityFormModal } = await import("./EntityFormModal");
const { addOrganizationConfig } = await import("./configs/addStandard");

function monter(enfant: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{enfant}</QueryClientProvider>);
}

beforeEach(() => {
  etat.navigate.mockReset();
  etat.creations = [];
});

describe("EntityFormModal — onCreated", () => {
  it("rend l'entité créée à l'appelant, et ne redirige PAS vers sa fiche", async () => {
    const onCreated = vi.fn();
    monter(<EntityFormModal config={addOrganizationConfig} open onOpenChange={() => {}} mode="add" onCreated={onCreated} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "soumettre" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREEE));
    expect(etat.creations).toHaveLength(1);
    expect(etat.navigate).not.toHaveBeenCalled();
  });

  it("sans onCreated, la création redirige vers la fiche — la règle par défaut est intacte", async () => {
    monter(<EntityFormModal config={addOrganizationConfig} open onOpenChange={() => {}} mode="add" />);

    await userEvent.setup().click(screen.getByRole("button", { name: "soumettre" }));
    await waitFor(() => expect(etat.navigate).toHaveBeenCalledWith("/profil/nouvelle-cae"));
  });
});
