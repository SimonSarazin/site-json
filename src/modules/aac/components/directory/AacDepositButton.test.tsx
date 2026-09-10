// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { AAC_QUERY_KEYS } from "../../constants/queryKeys";

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: { id: "u1" } }),
}));
vi.mock("@/modules/auth", () => ({
  useAuthModal: () => ({ openLogin: vi.fn() }),
}));
vi.mock("../../hooks/useAacConfig", () => ({
  useAacConfig: () => ({ config: { gates: { active: true } }, isLoading: false, error: null }),
}));
// La modale n'est pas le sujet : seul son `onAfterSubmit` compte — c'est lui
// qui annonce « un commun vient de naître ». Chargée en lazy par le bouton,
// donc résolue de manière asynchrone.
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: ({ onAfterSubmit }: { onAfterSubmit?: () => void }) => (
    <button type="button" onClick={onAfterSubmit}>
      envoyer
    </button>
  ),
}));

// Bundle « modules/aac » : les libellés sont ceux que verra l'utilisateur.
import "../../i18n";
import { AacDepositButton } from "./AacDepositButton";

function poser(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider>
        <AacDepositButton formId="f1" stepKey="aapStep1" />
      </LocalizationProvider>
    </QueryClientProvider>
  );
}

/** Ouvre la modale (session déjà établie) puis simule la soumission. */
async function deposer() {
  fireEvent.click(screen.getByRole("button", { name: "Je dépose un commun" }));
  fireEvent.click(await screen.findByRole("button", { name: "envoyer" }));
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

/**
 * M10 — le décompte du médaillon (`COUNT`) est calculé par le MÊME
 * `splitAacFilters` que le listing : il inclut le commun tout juste déposé.
 * Sans invalidation, son `staleTime` de 5 min laissait « Communs déposés »
 * afficher N sur la page d'accueil alors que l'annuaire en montrait N+1.
 */
describe("AacDepositButton — invalidations après dépôt (M10)", () => {
  it("invalide le décompte, pas seulement le listing et les facettes", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    poser(queryClient);

    await deposer();

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(AAC_QUERY_KEYS.COUNT_PREFIX());
    expect(keys).toContainEqual(AAC_QUERY_KEYS.COMMUNS_PREFIX());
    expect(keys).toContainEqual(AAC_QUERY_KEYS.FACETS_PREFIX());
  });
});
