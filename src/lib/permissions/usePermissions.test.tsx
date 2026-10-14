// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { reactive, type EntityTypes } from "@communecter/cocolight-api-client";
import { registerPermissions } from "./registry";
import { usePermissions } from "./usePermissions";

// `me` comme le SDK le tient : `serverData` réactif, mis à jour EN PLACE par `userContext.refresh()`.
const me = { serverData: reactive({ links: { memberOf: { org1: { isInviting: true } } } }) };
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me, entity: null }) }));

registerPermissions({
  namespace: "test-invitation",
  calculate: ({ me: m }) => {
    const lien = (m as typeof me).serverData.links as { memberOf: Record<string, { isInviting?: boolean }> };
    return { isInviting: lien.memberOf.org1?.isInviting === true };
  },
});

const NS = ["test-invitation"];

describe("usePermissions — liens mis à jour en place", () => {
  it("recalcule quand les liens de `me` changent sans changer de référence (invitation acceptée)", () => {
    const entity = { serverData: reactive({ links: {} }) } as unknown as EntityTypes;
    const { result } = renderHook(() => usePermissions<{ "test-invitation": { isInviting: boolean } }>(NS, entity));
    expect(result.current["test-invitation"].isInviting).toBe(true);

    act(() => {
      (me.serverData as Record<string, unknown>).links = { memberOf: { org1: { isMember: true } } };
    });

    expect(result.current["test-invitation"].isInviting).toBe(false);
  });
});
