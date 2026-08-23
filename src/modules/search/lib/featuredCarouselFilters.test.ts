import { describe, it, expect } from "vitest";
import { hasRenderableTitle } from "./featuredCarouselFilters";
import type { SearchListEntity } from "../schema";

const item = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as SearchListEntity;

describe("hasRenderableTitle", () => {
  it("accepte un titre non vide sur le champ par défaut (name)", () => {
    expect(hasRenderableTitle(item({ name: "InfoRéso" }), undefined)).toBe(true);
  });

  it("écarte un titre absent, vide ou composé uniquement d'espaces", () => {
    expect(hasRenderableTitle(item({}), undefined)).toBe(false);
    expect(hasRenderableTitle(item({ name: "" }), undefined)).toBe(false);
    expect(hasRenderableTitle(item({ name: "   " }), undefined)).toBe(false);
  });

  it("respecte un `titleField` custom de la config resource", () => {
    expect(hasRenderableTitle(item({ heading: "Titre custom" }), { titleField: "heading" })).toBe(true);
    expect(hasRenderableTitle(item({ name: "ignoré" }), { titleField: "heading" })).toBe(false);
  });
});
