import { describe, it, expect } from "vitest";
import { ArticleFeedSectionSchema, ArticleReaderSectionSchema } from "./schema";

describe("ArticleReaderSectionSchema", () => {
  it("valide avec slug", () => {
    expect(ArticleReaderSectionSchema.safeParse({ type: "articleReader", props: { slug: "mon-article" } }).success).toBe(true);
  });
  it("valide avec id (article slugless)", () => {
    expect(ArticleReaderSectionSchema.safeParse({ type: "articleReader", props: { id: "abc123" } }).success).toBe(true);
  });
  it("rejette sans slug NI id (refine)", () => {
    expect(ArticleReaderSectionSchema.safeParse({ type: "articleReader", props: {} }).success).toBe(false);
  });
});

describe("ArticleFeedSectionSchema", () => {
  it("valide sans density (comportement historique)", () => {
    expect(ArticleFeedSectionSchema.safeParse({ type: "articleFeed", props: { costumSlug: "parent62" } }).success).toBe(true);
  });
  it("valide avec density: \"compact\"", () => {
    expect(ArticleFeedSectionSchema.safeParse({ type: "articleFeed", props: { costumSlug: "parent62", density: "compact" } }).success).toBe(true);
  });
  it("rejette une valeur de density hors énum", () => {
    expect(ArticleFeedSectionSchema.safeParse({ type: "articleFeed", props: { costumSlug: "parent62", density: "tiny" } }).success).toBe(false);
  });
});
