import { describe, it, expect } from "vitest";
import { ArticleReaderSectionSchema } from "./schema";

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
