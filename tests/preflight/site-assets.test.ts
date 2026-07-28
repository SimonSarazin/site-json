import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Verrouille la relation « slug → dossier d'images » déclarée par sites.json,
 * dont dépend `SITE_IMAGES` au build (cf. siteImagesPlugin dans vite.config.ts).
 *
 * Le champ `images` est OPTIONNEL : une entrée qui ne le porte pas n'est pas en
 * faute, elle renonce simplement au filtrage. Ce fichier ne fait échouer que ce
 * qui est déclaré, et se contente de lister le reste.
 *
 * Le scan des configs porte sur le TEXTE BRUT et non sur les clés : plusieurs
 * configs référencent leurs images en chemin RELATIF à l'intérieur de chaînes
 * HTML de sections (`images/juliePotVin/img1.jpg`), invisibles à un parcours
 * d'objet. C'est précisément ce cas qui rend une dérivation automatique du
 * dossier dangereuse, et le champ déclaratif nécessaire.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const IMAGES_ROOT = path.join(PROJECT_ROOT, "public", "images");

interface SiteEntry {
  slug: string;
  config: string;
  css: string;
  images?: string | string[];
}

const sites: SiteEntry[] = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);

/**
 * Échappatoire pour un dossier de public/images/ qu'aucun slug ne revendique
 * mais qu'on garde sciemment. Doit rester vide : un dossier orphelin est du
 * poids mort embarqué dans toutes les images Docker non filtrées.
 *
 * `jardin` et `jardinCommuns` y ont figuré puis ont été supprimés du dépôt
 * (19,2 Mo). Leurs fichiers portaient des noms en 16 caractères hexadécimaux,
 * signature de server/middleware/imageUpload.js : des uploads accumulés par
 * l'AdminPanel sous un VITE_SLUG absent de sites.json. Ce middleware crée son
 * dossier au montage, donc le cas se reproduira à chaque slug essayé en dev.
 */
const KNOWN_UNCLAIMED: string[] = [];

/** Normalise le champ `images` (string | string[] | absent) en tableau. */
const declaredFolders = (site: SiteEntry): string[] =>
  site.images === undefined ? [] : Array.isArray(site.images) ? site.images : [site.images];

/**
 * Dossiers de `public/images/` référencés par le texte brut d'une config.
 * Couvre `/images/x/y.png`, `images/x/y.png`, `url(/images/x/…)` et les srcset.
 * Ne retient que ce qui existe RÉELLEMENT comme dossier : les chemins servis par
 * le backend (`/images/logoOauth/…`, préfixés par getBaseUrl à l'exécution) ne
 * correspondent à rien sur disque et ne concernent donc pas l'élagage.
 */
function referencedFolders(configFile: string): string[] {
  const raw = fs.readFileSync(path.join(PROJECT_ROOT, configFile), "utf-8");
  const re = /(?:^|[^a-zA-Z0-9._-])\/?images\/([^/"\\\s)?#]+)\//g;
  const found = new Set<string>();
  for (let m = re.exec(raw); m !== null; m = re.exec(raw)) found.add(m[1]);
  return [...found].filter((name) => {
    const dir = path.join(IMAGES_ROOT, name);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  });
}

const onDisk = fs.existsSync(IMAGES_ROOT)
  ? fs
      .readdirSync(IMAGES_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

describe("Preflight — sites.json : dossier d'images déclaré", () => {
  const declared = sites.filter((s) => s.images !== undefined);

  for (const site of declared) {
    describe(`${site.slug}`, () => {
      test("chaque dossier déclaré existe et n'est pas vide", () => {
        for (const name of declaredFolders(site)) {
          const dir = path.join(IMAGES_ROOT, name);
          expect(
            fs.existsSync(dir) && fs.statSync(dir).isDirectory(),
            `${site.slug}: public/images/${name}/ n'existe pas`,
          ).toBe(true);
          expect(
            fs.readdirSync(dir).length,
            `${site.slug}: public/images/${name}/ est vide`,
          ).toBeGreaterThan(0);
        }
      });

      test("le dossier déclaré couvre toutes les références de la config", () => {
        const declaredSet = new Set(declaredFolders(site));
        const missing = referencedFolders(site.config).filter((f) => !declaredSet.has(f));
        expect(
          missing,
          `${site.slug}: ${site.config} référence ${missing.join(", ")} — non déclaré(s) ` +
            `dans sites.json.images. Un build avec SITE_IMAGES=${[...declaredSet].join(",")} ` +
            `produirait un site aux visuels manquants.`,
        ).toHaveLength(0);
      });
    });
  }

  test("les entrées sans champ images sont listées (informatif, jamais bloquant)", () => {
    const sans = sites.filter((s) => s.images === undefined).map((s) => s.slug);
    if (sans.length > 0) {
      console.info(
        `[site-assets] ${sans.length} slug(s) sans champ "images" — ils embarqueront ` +
          `tous les dossiers de public/images/ : ${sans.join(", ")}`,
      );
    }
    expect(Array.isArray(sans)).toBe(true);
  });

  test("tout dossier de public/images/ est déclaré par au moins un slug", () => {
    const claimed = new Set(sites.flatMap(declaredFolders));
    const orphans = onDisk.filter(
      (name) => !claimed.has(name) && !KNOWN_UNCLAIMED.includes(name),
    );
    expect(
      orphans,
      `Dossier(s) de public/images/ qu'aucun slug ne déclare : ${orphans.join(", ")}. ` +
        `Ils sont embarqués dans toutes les images Docker non filtrées sans qu'aucun site ne les serve. ` +
        `Soit les supprimer, soit les déclarer, soit les ajouter à KNOWN_UNCLAIMED avec la raison.`,
    ).toHaveLength(0);
  });
});
