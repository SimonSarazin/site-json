import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { headerStickyOffsetPx } from "@/components/layout/header/headerOffset";
import type { Header } from "@/types/site-schema";

/**
 * `headerStickyOffsetPx` recopie des hauteurs qui vivent en dur dans le JSX des
 * headers (`h-20`, `py-5`, `sm:py-4`, la table `headerHeight`). Rien ne relie
 * les deux au compilateur : ce test lit les sources et échoue si une hauteur
 * bouge sans que la table soit mise à jour — sinon la sidebar sticky du profil
 * repasse silencieusement sous la barre.
 */

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, "src/components/layout/header", rel), "utf-8");

const base = { nav: [] } as unknown as Header;
const h = (over: Partial<Header>): Header => ({ ...base, ...over }) as Header;

describe("headerStickyOffsetPx — cohérence avec le JSX des headers", () => {
  it("les headers `fixed` inconditionnels le sont toujours", () => {
    for (const file of [
      "HeaderTransparentScroll.tsx",
      "HeaderUnderlineNav.tsx",
      "HeaderTransparentDark.tsx",
      "HeaderMinimal.tsx",
    ]) {
      const src = read(file);
      expect(src, `${file} doit rester fixed top-0`).toMatch(/fixed top-0/);
      expect(src, `${file} ne lit pas header.sticky`).not.toMatch(/header\.sticky/);
    }
  });

  it("les barres à hauteur fixe valent toujours 80px en desktop", () => {
    expect(read("HeaderTransparentScroll.tsx")).toMatch(/justify-between h-20/);
    expect(read("HeaderUnderlineNav.tsx")).toMatch(/justify-between h-20/);
    expect(read("HeaderTransparentDark.tsx")).toMatch(/justify-between h-16 md:h-20/);
  });

  it("les headers à hauteur de contenu gardent leur padding vertical", () => {
    expect(read("HeaderMinimal.tsx")).toMatch(/py-5/);
    expect(read("HeaderMegaMenu.tsx")).toMatch(/py-3 sm:py-4/);
  });

  it("HeaderStandard garde sa table de hauteurs et honore `sticky`", () => {
    const src = read("HeaderStandard.tsx");
    expect(src).toMatch(/sm:\s*'h-12'/);
    expect(src).toMatch(/md:\s*'h-16'/);
    expect(src).toMatch(/lg:\s*'h-20'/);
    expect(src).toMatch(/header\.sticky && 'sticky top-0/);
  });
});

describe("headerStickyOffsetPx — valeurs", () => {
  it("rend 0 quand le header défile avec la page", () => {
    expect(headerStickyOffsetPx(h({ type: "standard", sticky: false, height: "lg" }))).toBe(0);
    expect(headerStickyOffsetPx(h({ type: "default", height: "sm" }))).toBe(0); // sticky absent = falsy
    expect(headerStickyOffsetPx(h({ type: "mega-menu", sticky: false }))).toBe(0);
    expect(headerStickyOffsetPx(undefined)).toBe(0);
  });

  it("rend la hauteur de barre des headers collants/fixes", () => {
    expect(headerStickyOffsetPx(h({ type: "standard", sticky: true, height: "sm" }))).toBe(49);
    expect(headerStickyOffsetPx(h({ type: "standard", sticky: true, height: "lg" }))).toBe(81);
    expect(headerStickyOffsetPx(h({ type: "transparent-scroll", sticky: false }))).toBe(80);
    expect(headerStickyOffsetPx(h({ type: "underline-nav" }))).toBe(80);
    expect(headerStickyOffsetPx(h({ type: "transparent-dark" }))).toBe(80);
    expect(headerStickyOffsetPx(h({ type: "minimal", logoSize: "lg" }))).toBe(89);
    expect(headerStickyOffsetPx(h({ type: "mega-menu", sticky: true, logoSize: "lg" }))).toBe(81);
  });
});
