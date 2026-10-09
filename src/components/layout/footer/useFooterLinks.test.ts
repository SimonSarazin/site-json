// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FooterLink } from "@/types/site-schema";

let me: { serverData?: { slug?: string } } | null = null;
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me }) }));

// Une condition `auth: required` n'est vraie que connecté ; le reste est toujours visible.
const useVisibilityList = vi.fn((conditions: (FooterLink["visibility"] | undefined)[]) =>
  conditions.map((c) => !(c && (c as { auth?: string }).auth === "required") || me !== null),
);
vi.mock("@/lib/visibility", () => ({
  useVisibilityList: (conditions: (FooterLink["visibility"] | undefined)[]) => useVisibilityList(conditions),
}));

const { useFooterColumns, useFooterLinks, FOOTER_PROFILE_HREF } = await import("./useFooterLinks");

const lien = (href: string, auth?: "required"): FooterLink =>
  ({ href, label: { fr: href }, ...(auth ? { visibility: { auth } } : {}) }) as FooterLink;

const COLUMNS = [
  { title: { fr: "Compte" }, links: [lien(FOOTER_PROFILE_HREF, "required"), lien("/aide")] },
  { title: { fr: "Membres" }, links: [lien("/espace", "required")] },
];

beforeEach(() => {
  me = null;
  useVisibilityList.mockClear();
});

describe("useFooterColumns", () => {
  it("évalue la visibilité de toutes les colonnes en un seul appel", () => {
    renderHook(() => useFooterColumns(COLUMNS));
    expect(useVisibilityList).toHaveBeenCalledTimes(1);
    expect(useVisibilityList.mock.calls[0][0]).toHaveLength(3);
  });

  it("omet une colonne sans lien visible", () => {
    const { result } = renderHook(() => useFooterColumns(COLUMNS));
    expect(result.current.map(({ column }) => column.title.fr)).toEqual(["Compte"]);
    expect(result.current[0].links.map((l) => l.href)).toEqual(["/aide"]);
  });

  it("résout `@profile` sur la fiche de l'utilisateur connecté", () => {
    me = { serverData: { slug: "alice" } };
    const { result } = renderHook(() => useFooterColumns(COLUMNS));
    expect(result.current[0].links.map((l) => l.href)).toEqual(["/profil/alice", "/aide"]);
    expect(result.current[1].links.map((l) => l.href)).toEqual(["/espace"]);
  });

  it("retire `@profile` tant que le slug est inconnu", () => {
    me = { serverData: {} };
    const { result } = renderHook(() => useFooterColumns(COLUMNS));
    expect(result.current[0].links.map((l) => l.href)).toEqual(["/aide"]);
  });
});

describe("useFooterLinks", () => {
  it("garde la même liste de conditions d'un rendu à l'autre", () => {
    const links = COLUMNS[0].links;
    const { rerender } = renderHook(() => useFooterLinks(links));
    rerender();
    expect(useVisibilityList.mock.calls[1][0]).toBe(useVisibilityList.mock.calls[0][0]);
  });
});
