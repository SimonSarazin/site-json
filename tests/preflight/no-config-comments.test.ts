import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * PRÉFLIGHT : aucune clé de commentaire (`_comment`, `//`, `#`) dans les configs.
 *
 * POURQUOI c'est une garde et pas une préférence de style : `_comment` n'est déclaré par AUCUN
 * schéma zod, et les objets zod du parc ne sont ni `.strict()` ni `.passthrough()` — donc leur
 * comportement par défaut s'applique et la clé est **rabotée en silence** là où un schéma la
 * traverse, mais **survit** là où il n'y en a pas. Son sort dépend de l'ENDROIT où elle tombe :
 *
 *  - sous un objet schématisé (`admin.tabs[]`) → strippée ; `audit:config` la classe « config mort ».
 *  - sous un enregistrement libre (descripteur de champ d'un `costumForm`) → elle arrive jusqu'au
 *    runtime au milieu de vraies propriétés, et tout code qui itère les clés la voit.
 *
 * Le rationnel des choix de config vit dans `doc/` et dans les messages de commit, pas dans le
 * JSON livré au navigateur.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLES_INTERDITES = ["_comment", "//", "#", "$comment"];

const SITES = readdirSync(ROOT).filter((f) => /^config\.prod.*\.json$/.test(f));

/** Chemins (façon `.a.b[0].c`) de toute clé de commentaire rencontrée. */
function cheminsCommentes(valeur: unknown, chemin = ""): string[] {
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => cheminsCommentes(v, `${chemin}[${i}]`));
  if (valeur && typeof valeur === "object") {
    return Object.entries(valeur as Record<string, unknown>).flatMap(([cle, v]) =>
      CLES_INTERDITES.includes(cle) ? [`${chemin}.${cle}`] : cheminsCommentes(v, `${chemin}.${cle}`),
    );
  }
  return [];
}

describe("préflight — pas de clé de commentaire dans les configs", () => {
  for (const site of SITES) {
    it(site, () => {
      const cfg = JSON.parse(readFileSync(join(ROOT, site), "utf8")) as unknown;
      expect(cheminsCommentes(cfg)).toEqual([]);
    });
  }
});
