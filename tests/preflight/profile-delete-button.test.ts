import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * GARDE DU BOUTON DE SUPPRESSION (`profile-header.showDeleteButton`).
 *
 * L'action supprime la fiche de Communecter ENTIER — pas seulement du site qui l'affiche, à la
 * différence du « retrait » du référencement. Elle est donc absente par défaut, et cette sentinelle
 * dit QUI l'ouvre : un site qui l'active sans le vouloir (copie d'une config voisine, archétype)
 * apparaît ici en diff, site par site, comme un acte explicite.
 *
 * Deux invariants en plus de l'inventaire :
 *  - la destination après suppression doit être une PAGE RÉELLE du site (la fiche n'existe plus, une
 *    redirection vers une 404 serait la dernière chose vue par l'utilisateur) ;
 *  - l'option ne se pose que sur un profil d'ORGANISATION : les autres types (citoyens, events…)
 *    n'ont pas la notion d'« admin de la fiche » qu'exige la garde SDK `isAuthorOrAdmin`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface Section { type?: string; showDeleteButton?: unknown; deleteRedirectPath?: unknown }
interface Config {
  pages?: Array<{ path?: string }>;
  profiles?: Record<string, { sections?: Section[] } | undefined>;
}

const SITES = readdirSync(ROOT)
  .filter((f) => /^config\.prod\..+\.json$/.test(f))
  .sort()
  .map((f) => ({
    site: f.replace(/^config\.prod\./, "").replace(/\.json$/, ""),
    cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as Config,
  }));

/** `<site>/<typeDeProfil> → <destination>` pour chaque en-tête qui ouvre la suppression. */
function ouvertures(site: string, cfg: Config): string[] {
  return Object.entries(cfg.profiles ?? {}).flatMap(([typeProfil, profil]) =>
    (profil?.sections ?? [])
      .filter((s) => s.type === "profile-header" && s.showDeleteButton === true)
      .map((s) => `${site}/${typeProfil} → ${String(s.deleteRedirectPath ?? "/")}`),
  );
}

describe("Preflight — suppression d'une fiche depuis son profil", () => {
  it("seuls les sites listés ici proposent « Supprimer » (sentinelle d'inventaire)", () => {
    const parc = SITES.flatMap(({ site, cfg }) => ouvertures(site, cfg));
    expect(parc).toEqual([
      // tiers-lieux : un lieu est saisi par ses propres membres, qui doivent pouvoir le retirer du
      // réseau sans passer par un administrateur du site. Retour sur l'annuaire, la fiche n'étant plus.
      "tiers-lieux/organizations → /lieux",
    ]);
  });

  it("la destination après suppression est une page réelle du site", () => {
    for (const { site, cfg } of SITES) {
      const chemins = new Set((cfg.pages ?? []).map((p) => p.path));
      for (const ouverture of ouvertures(site, cfg)) {
        const destination = ouverture.split(" → ")[1];
        expect(chemins.has(destination), `${site} : « ${destination} » n'est pas une page du site`).toBe(true);
      }
    }
  });

  it("l'option n'est posée que sur un profil d'organisation", () => {
    for (const { site, cfg } of SITES) {
      for (const ouverture of ouvertures(site, cfg)) {
        expect(ouverture.startsWith(`${site}/organizations`), `${ouverture} : profil non éligible`).toBe(true);
      }
    }
  });
});
