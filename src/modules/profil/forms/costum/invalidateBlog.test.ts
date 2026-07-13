/**
 * Garde comportementale de `invalidate:blog` (form costum article). Prouve — SANS mutation — qu'après
 * add/edit d'un article, l'invalidation cible : le FIL (searchKeys → RESULTS_PREFIX), l'ABOUT par slug
 * (édition), et le DÉTAIL PAR ID (`useArticle` byId — les ~82 % d'articles slugless routés /blog/id/:id).
 */
import { describe, it, expect } from "vitest";
import "./sharedRegistrations"; // enregistre invalidate:standard + invalidate:blog
import { getInvalidateFn } from "../specRegistries";
import { PROFIL_QUERY_KEYS } from "../../constants";
import { SEARCH_QUERY_KEYS } from "@/modules/search/constants";
import { BLOG_QUERY_KEYS } from "@/modules/blog/constants/queryKeys";
import type { EntityModalCtx } from "../entityModalSpec";

const ctx = (mode: "add" | "edit"): EntityModalCtx =>
  ({ mode, entity: { slug: "mon-article", id: "abc123" }, me: { slug: "moi" } } as unknown as EntityModalCtx);
const params = { userList: "pois", searchKeys: ["blog:sportSanteBienetre"] };
const flat = (mode: "add" | "edit") =>
  (getInvalidateFn("invalidate:blog")!(ctx(mode), params)).map((k) => JSON.stringify(k));

describe("invalidate:blog", () => {
  it("édition : about-slug + fil + détail-par-id", () => {
    const keys = flat("edit");
    expect(keys).toContain(JSON.stringify(PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX("mon-article")));
    expect(keys).toContain(JSON.stringify(SEARCH_QUERY_KEYS.RESULTS_PREFIX("blog:sportSanteBienetre")));
    expect(keys).toContain(JSON.stringify(BLOG_QUERY_KEYS.ARTICLE_BY_ID("abc123")));
  });
  it("création : liste POI (me) + fil + détail-par-id", () => {
    const keys = flat("add");
    expect(keys).toContain(JSON.stringify(PROFIL_QUERY_KEYS.USER_POIS_PREFIX("moi")));
    expect(keys).toContain(JSON.stringify(SEARCH_QUERY_KEYS.RESULTS_PREFIX("blog:sportSanteBienetre")));
    expect(keys).toContain(JSON.stringify(BLOG_QUERY_KEYS.ARTICLE_BY_ID("abc123")));
  });
});
