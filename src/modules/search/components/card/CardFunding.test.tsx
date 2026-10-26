// @vitest-environment jsdom
/** « Activer financement » : une requête par double clic, bouton libéré à la fin de la requête. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";

const coremuOperation = vi.fn();

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/toastUtils", () => ({ showSuccessToast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: { coremuOperation } }) }));
vi.mock("@/modules/cagnotte/hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({ data: { projects: [], rawEnvelope: { formId: "form-1" } } }),
}));

import CardFunding from "./CardFunding";

const item = { id: "p1", serverData: { id: "p1", name: "Projet test" } } as unknown as SearchEntity;

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CardFunding item={item} card={{ variant: "funding" }} />
    </QueryClientProvider>,
  );
  return screen.getByRole("button", { name: /Activer financement/ });
}

describe("CardFunding — activation du financement", () => {
  beforeEach(() => {
    coremuOperation.mockReset();
  });

  it("un double clic n'envoie qu'une requête", async () => {
    coremuOperation.mockReturnValue(new Promise(() => {}));
    const button = renderCard();

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(coremuOperation).toHaveBeenCalled());
    await act(async () => {});
    expect(coremuOperation).toHaveBeenCalledTimes(1);
    expect(coremuOperation).toHaveBeenCalledWith({ form: "form-1", project: "p1" });
  });

  it("une fois la requête terminée, le bouton accepte un nouvel essai", async () => {
    let fail!: (error: Error) => void;
    coremuOperation.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const button = renderCard();

    fireEvent.click(button);
    await waitFor(() => expect(coremuOperation).toHaveBeenCalledTimes(1));
    await act(async () => fail(new Error("réseau")));
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));

    coremuOperation.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(button);
    await waitFor(() => expect(coremuOperation).toHaveBeenCalledTimes(2));
  });
});
