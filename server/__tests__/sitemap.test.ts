import { describe, it, expect } from "vitest";
import { buildSitemapXml, buildRobotsTxt } from "../lib/sitemap.js";

const BASE = "https://parents62.example.org";

// ────────────────────────────────────────────────────────────
// buildSitemapXml
// ────────────────────────────────────────────────────────────
describe("buildSitemapXml", () => {
  it("liste les pages publiques en URLs absolues, XML sitemaps.org valide", () => {
    const xml = buildSitemapXml([{ path: "/" }, { path: "/paroles" }], BASE);
    expect(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`)).toBe(true);
    expect(xml).toContain(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    expect(xml).toContain(`<url><loc>${BASE}/</loc></url>`);
    expect(xml).toContain(`<url><loc>${BASE}/paroles</loc></url>`);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("exclut les pages seo.noIndex === true (pas de signal contradictoire noindex ↔ sitemap)", () => {
    const xml = buildSitemapXml(
      [{ path: "/paroles" }, { path: "/admin", seo: { noIndex: true } }],
      BASE,
    );
    expect(xml).toContain("/paroles");
    expect(xml).not.toContain("/admin");
  });

  it("n'exclut pas une page dont seo.noIndex est absent ou false", () => {
    const xml = buildSitemapXml(
      [{ path: "/a", seo: {} }, { path: "/b", seo: { noIndex: false } }],
      BASE,
    );
    expect(xml).toContain(`<loc>${BASE}/a</loc>`);
    expect(xml).toContain(`<loc>${BASE}/b</loc>`);
  });

  it("exclut les paths paramétrés (placeholder ≠ URL réelle) et les liens externes", () => {
    const xml = buildSitemapXml(
      [
        { path: "/profil/:slug" },
        { path: "/docs/*" },
        { path: "https://exemple.org/externe" },
        { path: "/ok" },
      ],
      BASE,
    );
    expect(xml).not.toContain(":slug");
    expect(xml).not.toContain("/docs");
    expect(xml).not.toContain("exemple.org");
    expect(xml).toContain(`<loc>${BASE}/ok</loc>`);
  });

  it("ne double pas le slash quand baseUrl a un slash final", () => {
    const xml = buildSitemapXml([{ path: "/paroles" }], `${BASE}/`);
    expect(xml).toContain(`<loc>${BASE}/paroles</loc>`);
    expect(xml).not.toContain("org//paroles");
  });

  it("échappe les entités XML dans les URLs (path avec &)", () => {
    const xml = buildSitemapXml([{ path: "/a&b" }], BASE);
    expect(xml).toContain(`<loc>${BASE}/a&amp;b</loc>`);
    expect(xml).not.toContain("a&b<");
  });

  it("dédoublonne un path déclaré deux fois et tolère pages vide/malformé", () => {
    const xml = buildSitemapXml([{ path: "/x" }, { path: "/x" }, {}, { path: 42 }], BASE);
    expect(xml.match(/<loc>/g)).toHaveLength(1);
    // Sans aucune page valide : urlset vide mais document toujours bien formé
    const empty = buildSitemapXml(undefined as never, BASE);
    expect(empty).toContain("<urlset");
    expect(empty).toContain("</urlset>");
    expect(empty).not.toContain("<loc>");
  });
});

// ────────────────────────────────────────────────────────────
// buildRobotsTxt
// ────────────────────────────────────────────────────────────
describe("buildRobotsTxt", () => {
  it("autorise tout et pointe le sitemap absolu", () => {
    const txt = buildRobotsTxt(BASE);
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });

  it("ne double pas le slash quand baseUrl a un slash final", () => {
    const txt = buildRobotsTxt(`${BASE}/`);
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    expect(txt).not.toContain("org//sitemap.xml");
  });
});
