import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * PORTAIL SUR LES CLÉS MORTES DE CONFIG.
 *
 * `audit:config` sait déjà détecter la classe la plus insidieuse d'erreur de config : une clé que Zod
 * STRIPPE au parse. Il la trouve en diffant le JSON brut contre `SiteConfig.parse()`
 * (`scripts/audit-config.ts`, `strippedKeys`) — pas par vocabulaire ni par regex, donc il attrape
 * aussi le mot valide posé au mauvais endroit, ce qu'aucune liste ne saurait faire.
 *
 * Le problème n'était pas la détection, c'était l'absence de gâchette : le dépôt n'a **pas de CI**
 * (`.github/workflows` inexistant) et **pas de husky** (aucune dépendance, aucun script `prepare` ;
 * `.husky/` ne contient qu'un `_` résiduel). L'audit ne tournait donc que si quelqu'un le tapait.
 *
 * Ce test est la gâchette la moins coûteuse : versionnée, sans nouvelle dépendance, dans le runner
 * préflight qui existe.
 *
 * PÉRIMÈTRE — les SITES DÉPLOYÉS seulement, c'est-à-dire les configs déclarées dans `sites.json`.
 * Mesuré au moment de poser la garde : les 5 clés strippées du dépôt vivent toutes dans
 * `nos-commune` et `commune-transparente`, deux configs sans `coolifyApp` ni domaine — des gabarits,
 * pas des sites. Les gater ferait naître le portail rouge sur de la dette qui ne sert personne.
 *
 * ⚠️ ANGLE MORT MESURÉ — les sections IMBRIQUÉES échappent à cette garde. `CagnotteLayoutSectionSchema`
 * type ses colonnes en `z.array(z.unknown())` (`src/modules/cagnotte/schema.ts:119-120`), et
 * `profile-tab-layout` fait de même : une section posée là-dedans n'est JAMAIS parsée par Zod, donc
 * jamais strippée, donc invisible ici. Vérifié à la main : retirer trois clés d'`ActionsSectionSchema`
 * ne produit AUCUN nouveau constat d'audit, alors que 4 configs déployées les déclarent — parce que
 * leur section `actions` vit dans `cagnotte-layout.props.leftSections`.
 * Le boucher demanderait de typer ces colonnes en `z.array(z.lazy(() => Section))` — récursif, donc
 * un vrai changement de contrat, pas un ajustement de test.
 *
 * ⚠️ Volontairement PAS de garde sur `lien-mort` : 50 cas existent, et tant que le catch-all du
 * routeur sert la home en 200 pour un chemin inconnu, ils ne cassent rien de visible. Un portail qui
 * naît rouge est un portail qu'on désactive.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface Finding { category: string; path: string; message: string }
interface Rapport {
  configs: Record<string, { findings: Finding[]; assumed: Finding[] }>;
}

const deployees = new Set(
  (JSON.parse(readFileSync(path.join(ROOT, "sites.json"), "utf-8")) as Array<{
    config: string; coolifyApp?: string;
  }>)
    .filter((s) => s.coolifyApp)
    .map((s) => s.config),
);

const rapport = JSON.parse(
  execFileSync("npx", ["tsx", "scripts/audit-config.ts", "--json"], {
    cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024,
  }),
) as Rapport;

describe("clés de config strippées par Zod (sites déployés)", () => {
  it("le périmètre n'est pas vide — sinon la garde ne garde rien", () => {
    expect(deployees.size).toBeGreaterThan(8);
    expect(Object.keys(rapport.configs).length).toBeGreaterThan(8);
  });

  it("aucun site déployé ne porte de clé inconnue du schéma", () => {
    const coupables: string[] = [];
    for (const [fichier, r] of Object.entries(rapport.configs)) {
      if (!deployees.has(fichier)) continue;
      for (const f of r.findings) {
        if (f.category === "cle-strippee") coupables.push(`${fichier} → ${f.path}`);
      }
    }
    expect(
      coupables,
      "clés posées en config et SILENCIEUSEMENT ignorées par Zod — soit la clé est mal " +
        "orthographiée, soit elle est au mauvais niveau. Dans les deux cas la config ment sur ce " +
        "qu'elle fait. `npm run audit:config` donne le détail et la correction.",
    ).toEqual([]);
  });

  /**
   * PAS de garde sur `lien-inerte`, et la raison est structurelle, pas éditoriale.
   *
   * Un placeholder « # » assumé se déclare aujourd'hui dans `knownFindings` d'`archetypes.json` —
   * mais ce champ n'existe QUE pour les 9 archétypes. Les autres configs déployées n'ont que
   * `.audit-baseline.json`, qui est GITIGNORÉ : leur déclaration ne serait pas partagée, donc la
   * garde serait rouge chez tout le monde sauf son auteur.
   *
   * Mesuré : `tiers-lieux` et `relief` portent le MÊME placeholder au MÊME chemin
   * (`header.nav.4.children.2.path`, « Décider ensemble ») — relief a hérité la nav de son site de
   * famille. Il est déclaré assumé chez le premier, qui est archétype, et ne peut pas l'être chez
   * le second, qui ne l'est pas.
   *
   * Gater ici demanderait d'abord d'ouvrir un canal de déclaration versionné pour les configs hors
   * archétype. C'est un choix qui n'appartient pas à ce test.
   */
});
