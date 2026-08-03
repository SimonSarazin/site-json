import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Verrouille la chaîne des variables `VITE_*` destinées au NAVIGATEUR.
 *
 * Le piège qu'il ferme : une variable peut être déclarée dans `RuntimeEnv` et
 * lue par `readEnv` sans que le serveur l'injecte dans `window.__ENV__`. Elle
 * est alors visible du SSR (`process.env`) et invisible du client — asymétrie
 * qui ne se voit ni au typage, ni au lint, ni à l'exécution locale (en dev,
 * `import.meta.env` masque le trou). C'est arrivé à `VITE_COSTUM_FORCE_LIVE`,
 * restée inatteignable en production depuis son ajout.
 *
 * On parse les sources plutôt que d'importer : `prod-server.js` monte un
 * serveur Express au chargement. Même patron que section-meta.test.ts.
 */

const ROOT = path.resolve(__dirname, "../..");
const lire = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf-8");

/** Clés déclarées par `RuntimeEnv` (src/lib/constant/common.ts). */
function clesRuntimeEnv(): string[] {
  const src = lire("src/lib/constant/common.ts");
  const bloc = src.match(/export interface RuntimeEnv \{([\s\S]*?)\n\}/);
  if (!bloc) throw new Error("interface RuntimeEnv introuvable dans common.ts");
  return [...bloc[1].matchAll(/^\s*(VITE_[A-Z0-9_]+)\??\s*:/gm)].map((m) => m[1]);
}

/**
 * Position de l'AFFECTATION `window.__ENV__ = …`. On n'ancre pas sur la simple
 * chaîne `window.__ENV__` : les commentaires voisins la citent, et `indexOf`
 * tomberait dessus.
 */
function posAffectation(src: string, fichier: string): number {
  const m = src.match(/window\.__ENV__\s*=/);
  if (!m || m.index === undefined) {
    throw new Error(`affectation window.__ENV__ introuvable dans ${fichier}`);
  }
  return m.index;
}

/** Clés réellement écrites dans `window.__ENV__` par un serveur. */
function clesInjectees(fichier: string): string[] {
  const src = lire(fichier);
  const i = posAffectation(src, fichier);
  // La fenêtre couvre l'objet injecté ; large mais bornée avant le rendu SSR.
  const fenetre = src.slice(i, i + 1200);
  return [...new Set([...fenetre.matchAll(/(VITE_[A-Z0-9_]+)\s*:/g)].map((m) => m[1]))];
}

/**
 * Clés dont le SEUL consommateur est le serveur : inutile de les exposer au
 * client. À tenir à jour sciemment — y ajouter une clé est un acte, pas un
 * oubli.
 */
const SERVEUR_SEULEMENT = new Set<string>([]);

/**
 * Clés déclarées mais sans aucun appelant : `getMonApiKey`/`getMonDomain` sont
 * des vestiges (aucun consommateur dans src/). Ne pas exiger leur injection.
 */
const SANS_CONSOMMATEUR = new Set(["VITE_MON_API_KEY", "VITE_MON_DOMAIN"]);

describe("variables VITE_* runtime ⇄ injection window.__ENV__ (anti-dérive)", () => {
  test("toute clé de RuntimeAdEnv utile au client est injectée par prod-server", () => {
    const attendues = clesRuntimeEnv().filter(
      (k) => !SERVEUR_SEULEMENT.has(k) && !SANS_CONSOMMATEUR.has(k),
    );
    const injectees = clesInjectees("server/prod-server.js");
    const manquantes = attendues.filter((k) => !injectees.includes(k));
    expect(
      manquantes,
      `Déclarées dans RuntimeEnv mais absentes de window.__ENV__ (prod-server.js) : ` +
        `${manquantes.join(", ")}. Elles seront lues au SSR et pas au client. ` +
        `Ajoute-les à l'objet injecté ET à sa condition, ou classe-les dans ` +
        `SERVEUR_SEULEMENT / SANS_CONSOMMATEUR ici.`,
    ).toEqual([]);
  });

  test("dev et prod injectent le même jeu de clés", () => {
    const prod = clesInjectees("server/prod-server.js").sort();
    const dev = clesInjectees("server/dev-server.js").sort();
    expect(
      dev,
      "dev-server et prod-server doivent injecter les mêmes clés, sinon un " +
        "drapeau se comporte différemment en dev et en production.",
    ).toEqual(prod);
  });

  test("la condition d'injection couvre toutes les clés injectées", () => {
    const src = lire("server/prod-server.js");
    const i = posAffectation(src, "server/prod-server.js");
    // La condition `if (…)` précède immédiatement le bloc injecté.
    const avant = src.slice(Math.max(0, i - 700), i);
    const testees = new Set(
      [...avant.matchAll(/process\.env\.(VITE_[A-Z0-9_]+)/g)].map((m) => m[1]),
    );
    const oubliees = clesInjectees("server/prod-server.js").filter((k) => !testees.has(k));
    expect(
      oubliees,
      `Injectées mais absentes de la condition : ${oubliees.join(", ")}. ` +
        `Si elles sont seules définies, aucun <script> n'est émis.`,
    ).toEqual([]);
  });

  test("VITE_COSTUM_FORCE_LIVE est déployable par site", () => {
    const src = lire("scripts/lib/deploy-config.ts");
    // `variablesAttendues` ne consulte `site.env[clé]` que pour les clés de
    // CONSTANTES ou SECRETES : hors de ces listes, pas de surcharge par site.
    expect(
      /VITE_COSTUM_FORCE_LIVE/.test(src),
      "VITE_COSTUM_FORCE_LIVE doit figurer dans CONSTANTES (ou SECRETES) de " +
        "deploy-config.ts, sinon `deploy:env` ne la posera jamais et le champ " +
        "`env` de sites.json restera sans effet sur elle.",
    ).toBe(true);
  });
});
