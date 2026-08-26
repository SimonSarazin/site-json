import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * PRÉFLIGHT : aucune clé de commentaire (`_comment`, `//`, `#`, `$comment`) dans les configs.
 *
 * C'est une DÉCISION DE STYLE, assumée comme telle : le rationnel des choix de config vit dans
 * `doc/`, dans les doc-projets et dans les messages de commit — pas dans le JSON livré au
 * navigateur, où il n'a ni relecteur ni garde de fraîcheur.
 *
 * ⚠ Ce docstring affirmait auparavant que la clé était « rabotée en silence » faute d'être
 * déclarée. C'était FAUX pour 9 des 10 clés purgées : 7 vivaient dans `profiles.*.editModals[]`
 * et 2 dans `costumForms.*.mutation.stamps[]`, deux objets qui la DÉCLARAIENT — elle survivait
 * donc au parse. Une seule tombait sous un `z.object` nu. La justification technique ne tenait
 * pas ; la décision, elle, reste.
 *
 * La garde est désormais STRUCTURELLE plutôt que déclarative : `_comment` a été retiré des deux
 * zod qui l'acceptaient (`profil/schema.ts` editModals, `costumFormSchema.zod.ts` stamps), tous
 * deux `strict()`. Un `_comment` réintroduit fait donc échouer `config:validate` AVANT ce test,
 * y compris sur une config injectée par `SITE_CONFIG_PATH`/`SITE_CONFIG_JSON` — que le glob
 * ci-dessous ne peut pas voir. Ce test reste le filet pour les configs du dépôt.
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
