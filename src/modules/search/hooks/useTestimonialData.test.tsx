// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTestimonialData } from "./useTestimonialData";
import type { SearchListEntity, TestimonialConf } from "../schema";

/**
 * Le contrat `testimonial` est le SEUL point où la config d'un site décide quels champs `serverData`
 * nourrissent la card et la preview. Un défaut de code qui bouge (ou un champ qui cesse d'être projeté)
 * ne casse rien de VISIBLE en test d'intégration : la carte rend simplement un trou. D'où ces cas.
 *
 * L'`image` en particulier a une cascade à trois niveaux : elle doit survivre au fait que le backend
 * ne pose `profilMediumImageUrl` que pour une image de PROFIL — une image déposée en galerie n'arrive
 * que dans `medias`.
 */

const item = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as SearchListEntity;

describe("useTestimonialData", () => {
  const rendre = (sd: Record<string, unknown>, cfg?: TestimonialConf) =>
    renderHook(() => useTestimonialData(item(sd), cfg)).result.current;

  it("sans config : les défauts de code portent le rendu (description/name/created/medias)", () => {
    const data = rendre({
      name: "Le quotidien",
      description: "Une phrase de parent.",
      created: 1_700_000_000,
      medias: [{ type: "audio", url: "https://cdn.test/voix.mp3" }],
    });
    expect(data.quote).toBe("Une phrase de parent.");
    expect(data.title).toBe("Le quotidien");
    expect(data.audio).toBe("https://cdn.test/voix.mp3");
    expect(data.date).toBeInstanceOf(Date);
    expect(data.badge).toBeNull();
    expect(data.accent).toBeNull();
  });

  it("image : `profilMediumImageUrl` est la source par défaut", () => {
    const data = rendre({
      profilMediumImageUrl: "https://cdn.test/medium.jpg",
      profilImageUrl: "https://cdn.test/full.jpg",
    });
    expect(data.image).toBe("https://cdn.test/medium.jpg");
  });

  it("image : repli sur `profilImageUrl` quand la vignette n'est pas générée", () => {
    expect(rendre({ profilImageUrl: "https://cdn.test/full.jpg" }).image).toBe("https://cdn.test/full.jpg");
  });

  it("image : dernier repli sur la 1re image de `medias` (dépôt en galerie, pas en photo de profil)", () => {
    const data = rendre({
      medias: [
        { type: "audio", url: "https://cdn.test/voix.mp3" },
        { type: "image", url: "https://cdn.test/affiche.jpg" },
        { type: "image", url: "https://cdn.test/seconde.jpg" },
      ],
    });
    expect(data.image).toBe("https://cdn.test/affiche.jpg");
  });

  it("image : `imageField` de la config prend la main sur toute la cascade", () => {
    const data = rendre(
      { visuel: "https://cdn.test/choisi.jpg", profilMediumImageUrl: "https://cdn.test/medium.jpg" },
      { imageField: "visuel" },
    );
    expect(data.image).toBe("https://cdn.test/choisi.jpg");
  });

  it("image : `null` (et non chaîne vide) quand la parole n'en porte aucune — le rendu conditionne dessus", () => {
    expect(rendre({ name: "Sans visuel" }).image).toBeNull();
  });

  it("badge/accent : couleur de la map quand elle existe, palette déterministe sinon", () => {
    const cfg: TestimonialConf = {
      badge: { field: "category", colors: { "À changer": "var(--chart-4)" } },
      accent: { field: "territoires" },
    };
    const data = rendre({ category: "À changer", territoires: ["Artois", "Calaisis"] }, cfg);
    expect(data.badge).toEqual({ value: "À changer", color: "var(--chart-4)" });
    // Sans map : couleur stable dérivée de la valeur, jamais vide → la bulle a toujours une teinte.
    expect(data.accent?.value).toBe("Artois");
    expect(data.accent?.color).toMatch(/^var\(--/);
  });

  it("badge : sans map de couleurs, la catégorie reste rendue (suppression de `badge.colors` sur parent62)", () => {
    const data = rendre({ category: "Écrans" }, { badge: { field: "category" } });
    expect(data.badge?.value).toBe("Écrans");
    expect(data.badge?.color).toMatch(/^var\(--/);
  });

  it("facets : un repère dont le champ est vide est ÉCARTÉ (pas de colonne fantôme)", () => {
    const cfg: TestimonialConf = {
      facets: [{ field: "themes" }, { field: "publics" }],
    };
    const data = rendre({ themes: ["Les émotions"], publics: [] }, cfg);
    expect(data.facets.map((f) => f.field)).toEqual(["themes"]);
    expect(data.facets[0].tokens).toEqual(["Les émotions"]);
  });
});
