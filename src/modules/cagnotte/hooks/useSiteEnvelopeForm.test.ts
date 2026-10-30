// @vitest-environment jsdom
/** Le formulaire de l'enveloppe du site : celui de l'annuaire en type `aac`, aucun sinon. */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const state = vi.hoisted(() => ({ config: {} as Record<string, unknown> }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: state.config }) }));

const { useSiteEnvelopeForm } = await import("./useSiteEnvelopeForm");

function lire(config: Record<string, unknown>) {
  state.config = config;
  return renderHook(() => useSiteEnvelopeForm()).result.current;
}

describe("useSiteEnvelopeForm", () => {
  it("type aac : le formulaire de l'annuaire", () => {
    expect(lire({ cagnotteModuleConfig: { defaultType: "aac" }, aac: { formId: "form-aac" } })).toEqual({ id: "form-aac" });
  });

  it("cagnotte standard : aucun, même avec un AAC déclaré", () => {
    expect(lire({ aac: { formId: "form-aac" } })).toBeNull();
  });

  it("type aac sans AAC déclaré : aucun", () => {
    expect(lire({ cagnotteModuleConfig: { defaultType: "aac" } })).toBeNull();
  });
});
