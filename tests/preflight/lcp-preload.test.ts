import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractCriticalImages } from "@/lib/extractCriticalResources";
import { generateImagePreloadTags } from "@/lib/generatePreloadTags";
import { buildResponsiveSrcSet } from "@/lib/imageUtils";
import type { SiteConfig } from "@/types/site-schema";

/**
 * Chaîne de preload LCP — le seul échec VRAIMENT silencieux du patron d'ajout de section.
 *
 * Contexte : `extractCriticalResources.ts` décide quelles images méritent un
 * `<link rel="preload">` à partir de DEUX Set codés en dur et d'une lecture qui ne porte
 * que sur `sections[0]`. Un type de héro absent de ces Set n'émet aucun preload — et
 * RIEN ne le signale : ni le compilateur, ni le lint, ni `audit:config`, ni le rendu.
 * La page perd son LCP en silence.
 *
 * Jusqu'au 2026-07-30, `grep` sur `tests/` et `e2e/` ne donnait AUCUN résultat pour
 * `extractCritical`, `generateImagePreloadTags` ou `imagesrcset` : cette chaîne n'était
 * couverte nulle part. Ce fichier est né avec `hero-carousel`, qui l'a mise à l'épreuve.
 *
 * Ce que ces tests gardent, et pourquoi :
 *  1. la PARITÉ des deux Set — `SLIDES_BG_SECTION_TYPES` doit être un sous-ensemble de
 *     `RESPONSIVE_BG_SECTION_TYPES`, sinon la lecture « slides » n'est jamais atteinte,
 *     le filtre d'appartenance coupant avant ;
 *  2. l'ÉGALITÉ preload ⇄ rendu — `imagesrcset` doit être exactement le `srcSet` que
 *     `HeroBackgroundImage` produira, sinon le navigateur télécharge l'image DEUX fois ;
 *  3. l'UNICITÉ — une seule image en `fetchpriority="high"`, le plafond de priorité
 *     rendant le signal inutile au-delà de une ou deux.
 */

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src/lib/extractCriticalResources.ts");

/** Lit un Set littéral du module par son nom (lecture texte : les Set ne sont pas exportés). */
function readSet(name: string): string[] {
  const src = fs.readFileSync(SRC, "utf-8");
  const m = src.match(new RegExp(`const ${name} = new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) throw new Error(`Set ${name} introuvable dans ${SRC} — le test doit suivre le renommage.`);
  return [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1]);
}

/** Config minimale portant UNE page dont la 1re section est celle qu'on teste. */
function configWith(section: Record<string, unknown>): SiteConfig {
  return {
    pages: [{ path: "/", title: { fr: "Accueil" }, sections: [section] }],
  } as unknown as SiteConfig;
}

const IMG = "/images/test/hero.jpg";

describe("Préflight — chaîne de preload LCP", () => {
  it("SLIDES_BG_SECTION_TYPES est un sous-ensemble de RESPONSIVE_BG_SECTION_TYPES", () => {
    const responsive = new Set(readSet("RESPONSIVE_BG_SECTION_TYPES"));
    const slides = readSet("SLIDES_BG_SECTION_TYPES");
    const orphelins = slides.filter((t) => !responsive.has(t));
    expect(
      orphelins,
      `Types déclarés en lecture "slides" mais absents du Set d'éligibilité : ${orphelins.join(", ")}. ` +
        `Le filtre d'appartenance coupe AVANT la lecture — ces types n'émettraient aucun preload, en silence.`
    ).toHaveLength(0);
  });

  it("chaque type éligible a un chemin de lecture qui trouve réellement son image", () => {
    const responsive = readSet("RESPONSIVE_BG_SECTION_TYPES");
    const slides = new Set(readSet("SLIDES_BG_SECTION_TYPES"));

    for (const type of responsive) {
      // On fabrique la section dans la forme que son type est censé porter.
      const section = slides.has(type)
        ? { type, props: { slides: [{ headline: { fr: "A" }, backgroundImage: IMG }] } }
        : { type, props: { backgroundImage: IMG } };

      const images = extractCriticalImages(configWith(section), "/", undefined);
      const cible = images.filter((i) => i.src === IMG);

      expect(
        cible.length,
        `Le type "${type}" est déclaré éligible au preload mais aucune image n'a été extraite. ` +
          `Soit la forme de ses props a changé, soit il manque son chemin de lecture ` +
          `(cf. SLIDES_BG_SECTION_TYPES).`
      ).toBe(1);
      expect(cible[0].fetchpriority, `"${type}" doit être préchargé en priorité haute`).toBe("high");
      expect(cible[0].responsive, `"${type}" passe par HeroBackgroundImage → srcSet responsive`).toBe(true);
    }
  });

  it("un héro à diapositives ne précharge QUE la diapositive 0", () => {
    const section = {
      type: "hero-carousel",
      props: {
        slides: [
          { headline: { fr: "A" }, backgroundImage: "/images/test/a.jpg" },
          { headline: { fr: "B" }, backgroundImage: "/images/test/b.jpg" },
          { headline: { fr: "C" }, backgroundImage: "/images/test/c.jpg" },
        ],
      },
    };
    const images = extractCriticalImages(configWith(section), "/", undefined);
    const hautes = images.filter((i) => i.fetchpriority === "high");

    expect(hautes.map((i) => i.src)).toEqual(["/images/test/a.jpg"]);
    expect(
      images.some((i) => i.src === "/images/test/b.jpg" || i.src === "/images/test/c.jpg"),
      "Précharger les diapositives suivantes viole le plafond de priorité : au-delà d'une ou deux " +
        "images en priorité haute, le signal cesse d'être utile. Elles portent fetchpriority=low " +
        "dans le composant."
    ).toBe(false);
  });

  it("l'imagesrcset préchargé est EXACTEMENT celui que rendra HeroBackgroundImage", () => {
    const section = {
      type: "hero-carousel",
      props: { slides: [{ headline: { fr: "A" }, backgroundImage: IMG }] },
    };
    const balises = generateImagePreloadTags(extractCriticalImages(configWith(section), "/", undefined));
    const attendu = buildResponsiveSrcSet(IMG);

    expect(balises).toContain(`imagesrcset="${attendu}"`);
    expect(balises, "le sizes du preload doit égaler celui de l'<img> (100vw)").toContain('imagesizes="100vw"');
    // Une divergence ici = double téléchargement de l'image la plus lourde de la page.
    expect(attendu).toBe(buildResponsiveSrcSet(IMG));
  });

  it("une section à diapositives sans image n'émet aucun preload et ne lève pas", () => {
    const section = { type: "hero-carousel", props: { slides: [{ headline: { fr: "A" } }] } };
    expect(() => extractCriticalImages(configWith(section), "/", undefined)).not.toThrow();
    const images = extractCriticalImages(configWith(section), "/", undefined);
    expect(images.filter((i) => i.fetchpriority === "high")).toHaveLength(0);
  });

  it("un héro à diapositives en 2e position n'est PAS préchargé (seule sections[0] compte)", () => {
    const config = {
      pages: [
        {
          path: "/",
          title: { fr: "Accueil" },
          sections: [
            { type: "title", props: { title: { fr: "T" } } },
            { type: "hero-carousel", props: { slides: [{ headline: { fr: "A" }, backgroundImage: IMG }] } },
          ],
        },
      ],
    } as unknown as SiteConfig;

    const images = extractCriticalImages(config, "/", undefined);
    expect(
      images.filter((i) => i.src === IMG),
      "Comportement VOULU : sous la ligne de flottaison, ce n'est pas le LCP. Ce test documente " +
        "la limite pour qu'un futur élargissement à sections[1..n] soit un choix, pas un accident."
    ).toHaveLength(0);
  });
});
