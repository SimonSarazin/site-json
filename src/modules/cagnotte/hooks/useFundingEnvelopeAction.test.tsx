// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ entity: { fundingEnvelope: vi.fn() } as Record<string, unknown> | null, label: "v1" }));
// Comme le vrai `useT`, une nouvelle fonction à chaque rendu.
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => `${mocks.label}:${key}` }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: mocks.entity }) }));

const { useFundingEnvelopeAction } = await import("./useFundingEnvelopeAction");

describe("useFundingEnvelopeAction", () => {
  it("rend la même fonction d'un rendu à l'autre, tant que l'entité ne change pas", () => {
    const { result, rerender } = renderHook(() => useFundingEnvelopeAction());
    const first = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(first);
  });

  it("une erreur se traduit avec le traducteur du dernier rendu", async () => {
    mocks.entity = null;
    const { result, rerender } = renderHook(() => useFundingEnvelopeAction());
    mocks.label = "v2";
    rerender();

    await expect(result.current("pledgeStatus", {})).rejects.toThrow("v2:PaymentConfigPage.errors.fundingEnvelopeUnavailable");
  });
});
