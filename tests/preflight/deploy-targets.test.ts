import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  loadSites,
  asList,
  buildVars,
  coolifyDomains,
  deployableSites,
  ROOT,
} from "../../scripts/lib/sites";

/**
 * Verrouille les cibles de déploiement déclarées par `sites.json`.
 *
 * Ne touche pas au réseau : ce fichier tourne en CI et à chaque `test:unit`, il
 * ne doit dépendre ni de Coolify ni du DNS. Tout ce qui exige une instance est
 * vérifié par `npm run deploy:status`, à la main.
 *
 * Le champ `coolifyApp` est OPTIONNEL — 8 sites du parc n'ont pas encore
 * d'application. Ces entrées sont listées, jamais en échec : un site pas encore
 * déployé ne doit pas casser la CI. En revanche, dès qu'une entrée déclare une
 * application, elle doit être complète et cohérente.
 */

const sites = loadSites();
const deployables = deployableSites();

describe("Preflight — cibles de déploiement de sites.json", () => {
  test("chaque entrée avec coolifyApp a un domaine", () => {
    for (const s of deployables) {
      expect(
        asList(s.domain).length,
        `${s.slug} déclare l'application "${s.coolifyApp}" mais aucun domaine`,
      ).toBeGreaterThan(0);
    }
  });

  test("les noms d'application sont uniques", () => {
    const noms = deployables.map((s) => s.coolifyApp as string);
    const dupes = noms.filter((n, i) => noms.indexOf(n) !== i);
    expect(dupes, `Applications Coolify déclarées plusieurs fois : ${dupes.join(", ")}`).toHaveLength(0);
  });

  test("les domaines sont uniques dans tout le parc", () => {
    const tous = deployables.flatMap((s) => asList(s.domain));
    const dupes = tous.filter((d, i) => tous.indexOf(d) !== i);
    expect(
      dupes,
      `Domaine(s) déclaré(s) par plusieurs sites : ${dupes.join(", ")}. ` +
        `Coolify refuserait le second avec un conflit de domaine.`,
    ).toHaveLength(0);
  });

  test("les domaines sont des hôtes nus, sans protocole ni chemin", () => {
    for (const s of deployables) {
      for (const d of asList(s.domain)) {
        expect(d, `${s.slug} : "${d}" ne doit pas porter de protocole`).not.toMatch(/^https?:\/\//);
        expect(d, `${s.slug} : "${d}" ne doit pas porter de chemin`).not.toContain("/");
        expect(d, `${s.slug} : "${d}" n'est pas un nom d'hôte`).toMatch(
          /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/,
        );
      }
    }
  });

  test("le FQDN transmis à Coolify est bien préfixé", () => {
    for (const s of deployables) {
      for (const part of coolifyDomains(s).split(",")) {
        expect(part, `${s.slug} : FQDN mal formé`).toMatch(/^https:\/\/[^,]+$/);
      }
    }
  });
});

describe("Preflight — variables de build dérivées", () => {
  for (const s of sites) {
    test(`${s.slug} : les chemins dérivés existent`, () => {
      const v = buildVars(s);
      const css = path.join(ROOT, v.SITE_CSS_PATH.replace(/^\.\//, ""));
      const cfg = path.join(ROOT, v.SITE_CONFIG_PATH.replace(/^\.\//, ""));
      expect(fs.existsSync(css), `${s.slug} : ${v.SITE_CSS_PATH} introuvable`).toBe(true);
      expect(fs.existsSync(cfg), `${s.slug} : ${v.SITE_CONFIG_PATH} introuvable`).toBe(true);
      for (const dossier of asList(s.images)) {
        const dir = path.join(ROOT, "public", "images", dossier);
        expect(fs.existsSync(dir), `${s.slug} : public/images/${dossier}/ introuvable`).toBe(true);
      }
    });
  }

  test("SITE_EMBED vaut toujours true", () => {
    for (const s of sites) expect(buildVars(s).SITE_EMBED).toBe("true");
  });
});

describe("Preflight — couverture du parc", () => {
  test("les sites sans application sont listés (informatif, jamais bloquant)", () => {
    const sans = sites.filter((s) => !s.coolifyApp).map((s) => s.slug);
    if (sans.length > 0) {
      console.info(
        `[deploy-targets] ${sans.length} site(s) sans application Coolify : ${sans.join(", ")}`,
      );
    }
    expect(Array.isArray(sans)).toBe(true);
  });
});
