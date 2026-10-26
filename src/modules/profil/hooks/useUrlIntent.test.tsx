// @vitest-environment jsdom
/**
 * `?participer` / `?ajouter=event` : l'intention est lue au rendu, et `clear()` ne retire QUE
 * son paramètre. `useProfilePageIntent` ne la rend que pour l'entité de la page — un aperçu
 * d'événement dans un onglet de la fiche ne doit pas la voir.
 */
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { ProfileEntityContext, type ProfileEntityContextType } from "../contexts/ProfileEntityContext";
import { useProfilePageIntent, useUrlIntent } from "./useUrlIntent";

const PAGE = { serverData: { slug: "fete-du-lieu" } } as unknown as EntityTypes;
const APERCU = { serverData: { slug: "autre-evenement" } } as unknown as EntityTypes;

function routeur(search: string, page: EntityTypes | null = null) {
  const value = page ? ({ entity: page, config: {}, entityType: "event" } as unknown as ProfileEntityContextType) : null;
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[`/profil/fete-du-lieu${search}`]}>
        {value ? <ProfileEntityContext.Provider value={value}>{children}</ProfileEntityContext.Provider> : children}
      </MemoryRouter>
    );
  };
}

describe("useUrlIntent", () => {
  it("lit un drapeau et une valeur", () => {
    const { result } = renderHook(
      () => ({ participer: useUrlIntent("participer"), ajouter: useUrlIntent("ajouter") }),
      { wrapper: routeur("?participer&ajouter=event") },
    );
    expect(result.current.participer).toMatchObject({ present: true, value: null });
    expect(result.current.ajouter).toMatchObject({ present: true, value: "event" });
  });

  it("est absente sans le paramètre", () => {
    const { result } = renderHook(() => useUrlIntent("participer"), { wrapper: routeur("?tab=infos") });
    expect(result.current).toMatchObject({ present: false, value: null });
  });

  it("clear() retire SON paramètre et garde les autres", () => {
    const { result } = renderHook(
      () => ({ intent: useUrlIntent("participer"), search: useLocation().search }),
      { wrapper: routeur("?tab=infos&participer") },
    );
    act(() => result.current.intent.clear());
    expect(result.current.search).toBe("?tab=infos");
    expect(result.current.intent.present).toBe(false);
  });
});

describe("useProfilePageIntent", () => {
  it("rend l'intention pour l'entité de la page", () => {
    const { result } = renderHook(() => useProfilePageIntent("participer", PAGE), {
      wrapper: routeur("?participer", PAGE),
    });
    expect(result.current.present).toBe(true);
  });

  // L'aperçu d'un AUTRE événement (agenda dans un onglet de la fiche) n'est pas la page.
  it("la tait pour une autre entité, même sous le contexte de la page", () => {
    const { result } = renderHook(() => useProfilePageIntent("participer", APERCU), {
      wrapper: routeur("?participer", PAGE),
    });
    expect(result.current).toMatchObject({ present: false, value: null });
  });

  it("la tait hors de toute page de profil (agenda, recherche)", () => {
    const { result } = renderHook(() => useProfilePageIntent("participer", PAGE), {
      wrapper: routeur("?participer"),
    });
    expect(result.current.present).toBe(false);
  });
});
