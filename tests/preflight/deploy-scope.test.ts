import { describe, test, expect } from "vitest";
import { classer, impact } from "../../scripts/lib/deploy-scope";
import { loadSites, type SiteEntry } from "../../scripts/lib/sites";

/**
 * La table de classification, sur des chemins synthétiques. Aucun accès réseau,
 * aucun appel à git : on teste la règle, pas l'état du dépôt.
 */

const tous = loadSites();
const site = (slug: string): SiteEntry => {
  const s = tous.find((x) => x.slug === slug);
  if (!s) throw new Error(`slug de test introuvable : ${slug}`);
  return s;
};

const parent62 = site("parent62");
const cyberReunion = site("cyberReunion");
const etangsale1 = site("etangsale1");
const tampon = site("tampon");

describe("deploy-scope — fichiers propres au site", () => {
  test("sa config, son CSS et son dossier d'images", () => {
    expect(classer("config.prod.parent62.json", parent62, tous)).toBe("propre");
    expect(classer("src/index-parent62.css", parent62, tous)).toBe("propre");
    expect(classer("public/images/parent62/logo.png", parent62, tous)).toBe("propre");
    expect(classer("public/images/parent62/equipe/x.svg", parent62, tous)).toBe("propre");
  });

  test("une config partagée est propre à CHACUN de ses slugs", () => {
    // Six slugs communaux partagent config.prod.commune-transparente.json :
    // la modifier concerne les six, et eux seuls.
    expect(classer("config.prod.commune-transparente.json", etangsale1, tous)).toBe("propre");
    expect(classer("config.prod.commune-transparente.json", tampon, tous)).toBe("propre");
    expect(classer("config.prod.commune-transparente.json", parent62, tous)).toBe("neutre");
  });
});

describe("deploy-scope — le fichier d'un AUTRE site est neutre", () => {
  test("c'est la règle qui évite de tout redéployer", () => {
    expect(classer("config.prod.parent62.json", cyberReunion, tous)).toBe("neutre");
    expect(classer("src/index-parent62.css", cyberReunion, tous)).toBe("neutre");
    expect(classer("public/images/parent62/logo.png", cyberReunion, tous)).toBe("neutre");
  });
});

describe("deploy-scope — code partagé", () => {
  test.each([
    "src/components/SiteRenderer.tsx",
    "src/lib/buildRoutes.tsx",
    "server/prod-server.js",
    "server/utils/sites.js",
    "Dockerfile",
    "vite.config.ts",
    "package.json",
    "package-lock.json",
    "index.html",
    "public/images/defaultImage.png",
    "public/marker-icon.png",
  ])("%s est partagé", (chemin) => {
    expect(classer(chemin, parent62, tous)).toBe("partagé");
  });

  test("un chemin inconnu est partagé par prudence", () => {
    expect(classer("un/dossier/jamais/vu.ts", parent62, tous)).toBe("partagé");
  });
});

describe("deploy-scope — neutre", () => {
  test.each([
    "doc/16-deploiement-docker.md",
    "doc-projets/parent62.md",
    "commentaire/notes.md",
    "tests/preflight/deploy-scope.test.ts",
    "e2e/profile.spec.ts",
    "scripts/deploy.ts",
    "scripts/lib/sites.ts",
    "README.md",
    "eslint.config.js",
    "vitest.config.unit.ts",
    "playwright.config.ts",
    ".gitignore",
  ])("%s est neutre", (chemin) => {
    expect(classer(chemin, parent62, tous)).toBe("neutre");
  });

  test("sites.json est neutre, mais seulement parce que le parc est en mode mono-site", () => {
    // Cette neutralité repose sur une condition vérifiable : chaque application
    // passe ses chemins en clair, donc le build ne consulte jamais la table des
    // slugs. Le test documente l'hypothèse autant qu'il vérifie la règle.
    expect(classer("sites.json", parent62, tous)).toBe("neutre");
    for (const s of tous.filter((x) => x.coolifyApp)) {
      expect(s.config, `${s.slug} doit pouvoir fournir SITE_CONFIG_PATH en clair`).toBeTruthy();
      expect(s.css, `${s.slug} doit pouvoir fournir SITE_CSS_PATH en clair`).toBeTruthy();
    }
  });
});

describe("deploy-scope — impact global", () => {
  test("un commit de documentation ne redéploie personne", () => {
    const r = impact(["doc/16-deploiement-docker.md", "README.md"], parent62, tous);
    expect(r.aRedeployer).toBe(false);
    expect(r.neutre).toHaveLength(2);
  });

  test("un changement de server/ redéploie tout le monde", () => {
    for (const s of tous) {
      expect(impact(["server/prod-server.js"], s, tous).aRedeployer, s.slug).toBe(true);
    }
  });

  test("la config d'un site ne redéploie que lui", () => {
    const concernes = tous.filter((s) => impact(["config.prod.parent62.json"], s, tous).aRedeployer);
    expect(concernes.map((s) => s.slug)).toEqual(["parent62"]);
  });

  test("la config communale redéploie les six communes, pas plus", () => {
    const concernes = tous
      .filter((s) => impact(["config.prod.commune-transparente.json"], s, tous).aRedeployer)
      .map((s) => s.slug);
    expect(concernes).toHaveLength(6);
    expect(concernes).toContain("etangsale1");
    expect(concernes).not.toContain("parent62");
  });
});
