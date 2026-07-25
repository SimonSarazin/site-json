import { describe, it, expect } from "vitest";
import { resolveItemLink, resolveItemClick } from "./itemAction";
import type { SearchListEntity } from "../schema";

const item = (data: Record<string, unknown>) => data as unknown as SearchListEntity;

const BLOG = { kind: "link", to: "/blog/:slug", toById: "/blog/id/:id" } as const;

describe("resolveItemLink", () => {
  it("substitue `:slug` quand l'item a un slug", () => {
    expect(resolveItemLink(item({ slug: "mon-article" }), BLOG)).toBe("/blog/mon-article");
    expect(resolveItemLink(item({ serverData: { slug: "via-serverdata" } }), BLOG)).toBe("/blog/via-serverdata");
  });

  it("retombe sur `:id` quand l'item n'a PAS de slug (~82% des articles)", () => {
    expect(resolveItemLink(item({ id: "42" }), BLOG)).toBe("/blog/id/42");
  });

  it("renvoie null si ni slug ni id — l'appelant ne doit pas naviguer vers /blog/id/undefined", () => {
    expect(resolveItemLink(item({ serverData: {} }), BLOG)).toBeNull();
    expect(resolveItemLink(undefined, BLOG)).toBeNull();
    expect(resolveItemLink(item({ slug: "x" }), undefined)).toBeNull();
  });

  it("échappe les valeurs pour l'URL", () => {
    expect(resolveItemLink(item({ slug: "a b/c" }), BLOG)).toBe("/blog/a%20b%2Fc");
  });

  it("un gabarit sans placeholder est un lien statique", () => {
    expect(resolveItemLink(item({ serverData: {} }), { kind: "link", to: "/blog" })).toBe("/blog");
  });
});

/**
 * Cascade de décision partagée par `SearchListView` (clic carte de liste) et `SearchMap`
 * (bouton de popup) — les deux appliquaient sinon la même logique en double.
 */
describe("resolveItemClick", () => {
  const article = item({ slug: "mon-article", serverData: {} });
  const sansSlug = item({ id: "42", serverData: {} });
  const nu = item({ serverData: {} });

  it("action absente → ouvrir le détail", () => {
    expect(resolveItemClick(article, undefined)).toEqual({ kind: "details" });
    expect(resolveItemClick(article, { kind: "preview" })).toEqual({ kind: "details" });
  });

  it("link → href résolu, avec le drapeau newTab", () => {
    expect(resolveItemClick(article, BLOG)).toEqual({ kind: "link", href: "/blog/mon-article", newTab: false });
    expect(resolveItemClick(sansSlug, BLOG)).toEqual({ kind: "link", href: "/blog/id/42", newTab: false });
    expect(resolveItemClick(article, { ...BLOG, newTab: true })).toMatchObject({ newTab: true });
  });

  it("profil → /profil/:slug", () => {
    expect(resolveItemClick(article, { kind: "profil" })).toEqual({ kind: "profil", href: "/profil/mon-article" });
  });

  it("REPLI : toute action inexploitable retombe sur le détail (jamais d'URL trouée)", () => {
    expect(resolveItemClick(nu, BLOG)).toEqual({ kind: "details" });
    expect(resolveItemClick(sansSlug, { kind: "profil" })).toEqual({ kind: "details" });
    expect(resolveItemClick(article, { kind: "link" })).toEqual({ kind: "details" });
  });
});
