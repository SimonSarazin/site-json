// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Bouton « Modifier » du détail d'une réponse CoForm (`preview.editButton`) :
 *  - proposé au gestionnaire OU à l'auteur (`canEditCoformAnswer`), à personne d'autre ;
 *  - pendant le chargement de la fiche : `aria-disabled` (pas `disabled`, qui perdrait le focus) et
 *    une annonce ; après un échec, un nouveau clic RELANCE le chargement ;
 *  - après l'enregistrement : listes statiques ET listes gérées du compte rafraîchies, message,
 *    fermeture du détail.
 * Le formulaire et la lecture de la fiche sont doublés : on teste le câblage, pas le serveur.
 */
const ctx = vi.hoisted(() => ({
  me: null as unknown,
  entity: { isAdmin: () => false } as unknown,
  answer: { answerData: null as unknown, isLoading: false, error: null as Error | null },
  refetch: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ctx.me, entity: ctx.entity }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key}${JSON.stringify(params)}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("sonner", () => ({ toast: { success: ctx.toastSuccess, error: vi.fn() } }));
vi.mock("@/modules/coform/hooks/useCoFormQuery", () => ({
  useCoFormAnswerQuery: ({ enabled }: { enabled: boolean }) =>
    enabled
      ? { ...ctx.answer, answer: null, refetch: ctx.refetch }
      : { answerData: null, answer: null, isLoading: false, error: null, refetch: ctx.refetch },
}));
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: (props: { title?: string; onAfterSubmit?: () => void }) => (
    <div data-testid="coform-modal">
      <span data-testid="coform-title">{props.title}</span>
      <button type="button" onClick={() => props.onAfterSubmit?.()}>
        enregistrer
      </button>
    </div>
  ),
}));

import PreviewCoformAnswer from "./PreviewCoformAnswer";

const ME = "6448f244ecf6e50e4b539677";
const FORM = "6928096adf5caf0d230e7f26";
const lambda = { id: ME, isSuperAdmin: () => false, isAdminPlatform: () => false };
const EDIT = { type: "coform-answer", editButton: true } as never;
const item = (serverData: Record<string, unknown>) =>
  ({ id: "a1", serverData: { form: FORM, sportSanteBienetre2172025_854_0mdegc9sgox76p87n27: "TEST BASKET", ...serverData } }) as unknown as SearchEntity;

let queryClient: QueryClient;
const renderPreview = (props: { item: SearchEntity; preview?: never; onClose?: () => void }) =>
  render(
    <QueryClientProvider client={queryClient}>
      <PreviewCoformAnswer {...props} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  queryClient = new QueryClient();
  ctx.me = lambda;
  ctx.entity = { isAdmin: () => false };
  ctx.answer = { answerData: null, isLoading: false, error: null };
  ctx.refetch.mockClear();
  ctx.toastSuccess.mockClear();
});

describe("PreviewCoformAnswer — qui voit « Modifier »", () => {
  it("l'auteur, quand la recherche projette `user` — avec sa région d'annonce, présente et vide AVANT tout chargement", () => {
    renderPreview({ item: item({ user: ME }), preview: EDIT });
    expect(screen.getByRole("button", { name: "coformAnswer.edit" })).toBeTruthy();
    // Un lecteur d'écran n'annonce que les changements d'une région déjà dans le DOM.
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("personne d'autre : ni un tiers, ni l'auteur sans `preview.editButton`", () => {
    const { unmount } = renderPreview({ item: item({ user: "5f0f0f0f0f0f0f0f0f0f0f0a" }), preview: EDIT });
    expect(screen.queryByRole("button", { name: "coformAnswer.edit" })).toBeNull();
    unmount();
    renderPreview({ item: item({ user: ME }) });
    expect(screen.queryByRole("button", { name: "coformAnswer.edit" })).toBeNull();
  });
});

describe("PreviewCoformAnswer — modifier", () => {
  it("chargement : `aria-disabled` et annonce, jamais `disabled` (le focus resterait sur `body`)", () => {
    ctx.answer = { answerData: null, isLoading: true, error: null };
    renderPreview({ item: item({ user: ME }), preview: EDIT });
    const bouton = screen.getByRole("button", { name: "coformAnswer.edit" });
    fireEvent.click(bouton);
    expect(bouton.getAttribute("aria-disabled")).toBe("true");
    expect(bouton.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("coformAnswer.editLoading");
  });

  it("échec : le dit, et un nouveau clic RELANCE le chargement", () => {
    ctx.answer = { answerData: null, isLoading: false, error: new Error("réseau") };
    renderPreview({ item: item({ user: ME }), preview: EDIT });
    const bouton = screen.getByRole("button", { name: "coformAnswer.edit" });
    fireEvent.click(bouton);
    expect(screen.getByRole("alert").textContent).toContain("coformAnswer.editError");
    expect(ctx.refetch).not.toHaveBeenCalled();
    fireEvent.click(bouton);
    expect(ctx.refetch).toHaveBeenCalledTimes(1);
  });

  it("rafraîchissement de fond en échec, fiche en cache : le formulaire reste ouvert (saisie préservée)", async () => {
    ctx.answer = { answerData: { step: {} }, isLoading: false, error: new Error("réseau") };
    renderPreview({ item: item({ user: ME }), preview: EDIT });
    fireEvent.click(screen.getByRole("button", { name: "coformAnswer.edit" }));
    expect(await screen.findByTestId("coform-modal", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("enregistrement : listes statiques ET listes gérées du compte rafraîchies, message, détail fermé", async () => {
    ctx.answer = { answerData: { step: {} }, isLoading: false, error: null };
    const onClose = vi.fn();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderPreview({ item: item({ user: ME }), preview: EDIT, onClose });
    fireEvent.click(screen.getByRole("button", { name: "coformAnswer.edit" }));
    expect((await screen.findByTestId("coform-title", {}, { timeout: 5000 })).textContent).toBe(
      'coformAnswer.editTitle{"title":"TEST BASKET"}',
    );
    fireEvent.click(screen.getByText("enregistrer"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["searchCostumStatic"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["searchCostumStaticMapAll"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [`managed-answers:${ME}`] });
    expect(ctx.toastSuccess).toHaveBeenCalledWith("coformAnswer.edited");
  });
});
