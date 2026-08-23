import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { imageFolderForSlug, findSiteBySlug } from "../utils/sites.js";

/**
 * Garde du découplage slug → dossier d'images (`sites.json` champ `images`). C'est ce que
 * `imageUpload.js` résout pour écrire dans le dossier RÉELLEMENT servi et ne plus fabriquer de
 * dossier fantôme `public/images/<slug>/` (cf. préflight `tests/preflight/site-assets.test.ts`).
 */
describe("imageFolderForSlug — dossier d'images découplé du slug", () => {
  let root: string;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "sites-json-"));
    fs.writeFileSync(
      path.join(root, "sites.json"),
      JSON.stringify([
        { slug: "navigatorDesTierslieux", images: "tiersLieux" }, // le cas réel : dossier ≠ slug
        { slug: "multi", images: ["premier", "second"] },
        { slug: "sansImages", config: "x.json" },
        { slug: "videImages", images: "   " },
      ]),
    );
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("champ images (string) → ce dossier, pas le slug", () => {
    expect(imageFolderForSlug("navigatorDesTierslieux", root)).toBe("tiersLieux");
    // cohérent avec la source lue par le préflight site-assets
    expect(findSiteBySlug("navigatorDesTierslieux", root)?.images).toBe("tiersLieux");
  });
  it("champ images (tableau) → le premier élément", () => {
    expect(imageFolderForSlug("multi", root)).toBe("premier");
  });
  it("pas de champ images → fallback slug", () => {
    expect(imageFolderForSlug("sansImages", root)).toBe("sansImages");
  });
  it("champ images vide/espaces → fallback slug", () => {
    expect(imageFolderForSlug("videImages", root)).toBe("videImages");
  });
  it("slug inconnu de sites.json → fallback slug", () => {
    expect(imageFolderForSlug("inconnu", root)).toBe("inconnu");
  });
  it("sites.json absent (image Docker) → fallback slug, aucune régression", () => {
    expect(imageFolderForSlug("navigatorDesTierslieux", path.join(root, "nexiste-pas"))).toBe(
      "navigatorDesTierslieux",
    );
  });
  it('slug vide → "default"', () => {
    expect(imageFolderForSlug("", root)).toBe("default");
  });
});
