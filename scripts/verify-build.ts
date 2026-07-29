/**
 * Vérifie qu'un `dist/` fraîchement construit correspond bien au site demandé.
 *
 * Le dépôt n'a ni CI, ni healthcheck, ni test qui exécute prod-server ou lise
 * `dist/` : les tests d'intégration et E2E passent tous par le serveur de
 * développement. Le mode d'échec « le build a produit le mauvais site » —
 * mauvais CSS, mauvaise config, mauvaises images — n'est donc détectable
 * aujourd'hui qu'à l'œil, en production. C'est le trou que ce script bouche.
 *
 * Usage :  npm run verify:build
 *          avec LES MÊMES variables que le build qui vient d'être lancé :
 *          VITE_SLUG, SITE_IMAGES, SITE_EMBED, SITE_CONFIG_PATH, SITE_CSS_PATH.
 *
 * Sortie : exit 0 si tout concorde, exit 1 avec le détail sinon.
 */
import fs from "node:fs";
import path from "node:path";
import { SiteConfig } from "../src/types/site-schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const CLIENT = path.join(DIST, "client");

interface SiteEntry {
  slug: string;
  config: string;
  css: string;
  images?: string | string[];
}

const env = process.env;
const isTruthy = (v?: string) =>
  v !== undefined && ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());

const failures: string[] = [];
const notes: string[] = [];
const fail = (msg: string) => failures.push(msg);
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const skip = (msg: string) => notes.push(msg);

function readSites(): SiteEntry[] {
  const p = path.join(ROOT, "sites.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : [];
}

/* ── 1. Le build a bien eu lieu ──────────────────────────────────────────── */

console.log("Vérification de dist/\n");

if (!fs.existsSync(path.join(CLIENT, "index.html"))) {
  fail("dist/client/index.html est absent — le build client n'a pas abouti.");
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
ok("dist/client/index.html présent");

/* ── 2. Le bundle SSR ne recopie plus public/ ────────────────────────────── */

const ssrPublic = ["images", "france-regions.geojson", "marker-icon.png"].filter((n) =>
  fs.existsSync(path.join(DIST, "server", n)),
);
if (ssrPublic.length > 0) {
  fail(
    `dist/server/ contient ${ssrPublic.join(", ")} — le build SSR recopie publicDir alors ` +
      `que rien ne l'y sert. Vérifier build.copyPublicDir dans vite.config.ts.`,
  );
} else {
  ok("dist/server/ ne contient pas de copie de public/");
}

/* ── 3. Images : seuls les dossiers demandés ─────────────────────────────── */

const wantedImages = env.SITE_IMAGES?.trim()
  ? env.SITE_IMAGES.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const distImages = path.join(CLIENT, "images");
if (!wantedImages) {
  skip("SITE_IMAGES non posé — aucune attente sur les dossiers d'images.");
} else if (!fs.existsSync(distImages)) {
  fail("dist/client/images/ est absent alors que SITE_IMAGES est posé.");
} else {
  const present = fs
    .readdirSync(distImages, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const extra = present.filter((n) => !wantedImages.includes(n));
  const missing = wantedImages.filter((n) => !present.includes(n));

  if (extra.length > 0) {
    fail(
      `dist/client/images/ contient ${extra.join(", ")} — non demandé(s) par ` +
        `SITE_IMAGES=${wantedImages.join(",")}. L'élagage n'a pas eu lieu ` +
        `(nom erroné ? le plugin retombe alors en no-op).`,
    );
  }
  if (missing.length > 0) {
    fail(`dist/client/images/ ne contient pas ${missing.join(", ")}, pourtant demandé(s).`);
  }
  for (const name of wantedImages) {
    const dir = path.join(distImages, name);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fail(`dist/client/images/${name}/ est vide.`);
    }
  }
  if (extra.length === 0 && missing.length === 0) {
    ok(`dist/client/images/ ne contient que ${wantedImages.join(", ")}`);
  }

  // Les fichiers partagés ne sont jamais élagués (ce sont des fichiers, pas des
  // dossiers) — mais une régression du filtre les emporterait en silence.
  for (const shared of ["images/defaultImage.png", "marker-icon.png", "marker-shadow.png"]) {
    if (!fs.existsSync(path.join(CLIENT, shared))) {
      fail(`${shared} manque dans dist/client/ — il est partagé par tous les sites.`);
    }
  }
}

/* ── 4. Config figée : copie conforme et valide ──────────────────────────── */

const builtConfig = path.join(DIST, "site-config.json");
if (!isTruthy(env.SITE_EMBED)) {
  if (fs.existsSync(builtConfig)) {
    fail("dist/site-config.json existe alors que SITE_EMBED n'est pas posé — dist/ est périmé ?");
  } else {
    skip("SITE_EMBED non posé — aucune config figée attendue.");
  }
} else if (!fs.existsSync(builtConfig)) {
  fail(
    "SITE_EMBED est posé mais dist/site-config.json est absent — ni SITE_CONFIG_JSON ni " +
      "SITE_CONFIG_PATH n'a été résolu au build (le plugin l'annonce en warning).",
  );
} else {
  const raw = fs.readFileSync(builtConfig, "utf-8");

  if (env.SITE_CONFIG_PATH) {
    const src = path.isAbsolute(env.SITE_CONFIG_PATH)
      ? env.SITE_CONFIG_PATH
      : path.resolve(ROOT, env.SITE_CONFIG_PATH);
    if (!fs.existsSync(src)) {
      fail(`SITE_CONFIG_PATH pointe sur ${env.SITE_CONFIG_PATH}, introuvable.`);
    } else if (fs.readFileSync(src, "utf-8") !== raw) {
      fail(`dist/site-config.json diffère de ${env.SITE_CONFIG_PATH} — ce doit être une copie conforme.`);
    } else {
      ok(`dist/site-config.json est identique à ${env.SITE_CONFIG_PATH}`);
    }
  }

  const parsed = SiteConfig.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    fail(`dist/site-config.json ne passe pas SiteConfigSchema :\n      ${issues.join("\n      ")}`);
  } else {
    const title =
      (parsed.data as { meta?: { title?: Record<string, string> } }).meta?.title?.fr ?? "(sans titre)";
    ok(`dist/site-config.json valide Zod — « ${title} »`);
  }
}

/* ── 5. CSS : celui du site attendu, et d'aucun autre ────────────────────── */

function expectedCssFile(): string | null {
  if (env.SITE_CSS_CONTENT) return null; // contenu inline : rien à comparer
  if (env.SITE_CSS_PATH) {
    return path.isAbsolute(env.SITE_CSS_PATH)
      ? env.SITE_CSS_PATH
      : path.resolve(ROOT, env.SITE_CSS_PATH);
  }
  const site = readSites().find((s) => s.slug === env.VITE_SLUG);
  if (site?.css) return path.join(ROOT, "src", `${site.css}.css`);
  return path.join(ROOT, "src", "index.css");
}

/** Noms de classes déclarés par un fichier CSS. */
function classNames(file: string): Set<string> {
  const css = fs.readFileSync(file, "utf-8");
  const names = new Set<string>();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]{2,})/g)) names.add(m[1]);
  return names;
}

const cssFile = expectedCssFile();
if (!cssFile) {
  skip("SITE_CSS_CONTENT posé — le CSS attendu n'est pas un fichier du dépôt, contrôle impossible.");
} else if (!fs.existsSync(cssFile)) {
  fail(`Le CSS attendu (${path.relative(ROOT, cssFile)}) n'existe pas.`);
} else {
  const allCss = fs
    .readdirSync(path.join(ROOT, "src"))
    .filter((f) => /^index.*\.css$/.test(f))
    .map((f) => path.join(ROOT, "src", f));

  // Une classe sert d'empreinte si elle est EXCLUSIVE à un fichier de thème et
  // DISTINCTIVE. Le second critère est indispensable : `fixed`, `active`, `org`
  // ou `marker` n'apparaissent que dans un seul thème mais sont aussi émis par
  // les utilitaires Tailwind, donc présents dans tous les bundles. Les classes
  // sur-mesure du dépôt sont uniformément en kebab-case (`releve-eyebrow`,
  // `trait-cote`, `p62-bubble`, `hero-nos-communes`), ce qui les sépare
  // proprement du bruit.
  const counts = new Map<string, number>();
  const perFile = new Map<string, Set<string>>();
  for (const f of allCss) {
    const names = classNames(f);
    perFile.set(f, names);
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const exclusive = (f: string) =>
    [...(perFile.get(f) ?? [])].filter(
      (n) => counts.get(n) === 1 && n.includes("-") && n.length >= 5,
    );

  const assetsDir = path.join(CLIENT, "assets");
  const bundled = fs.existsSync(assetsDir)
    ? fs
        .readdirSync(assetsDir)
        .filter((f) => f.endsWith(".css"))
        .map((f) => fs.readFileSync(path.join(assetsDir, f), "utf-8"))
        .join("\n")
    : "";

  const mine = exclusive(cssFile);
  if (mine.length === 0) {
    // Six thèmes sur treize sont dans ce cas : ils ne portent aucune classe
    // sur-mesure, tout leur habillage vient des tokens de `config.theme`
    // injectés au runtime par SiteTheme. Rien à empreindre, on le dit.
    skip(
      `${path.relative(ROOT, cssFile)} n'a aucun sélecteur sur-mesure qui lui soit exclusif — ` +
        `impossible de le distinguer des autres thèmes dans le bundle (son habillage vient ` +
        `de config.theme, pas du CSS). Le contrôle de la config, lui, reste valable.`,
    );
  } else {
    const found = mine.filter((n) => bundled.includes(`.${n}`));
    if (found.length === 0) {
      fail(
        `Aucun sélecteur exclusif de ${path.relative(ROOT, cssFile)} n'apparaît dans le CSS ` +
          `de dist/client/assets/ — le build a bundlé un autre thème. ` +
          `Cherchés : ${mine.slice(0, 6).join(", ")}`,
      );
    } else {
      ok(`le CSS bundlé porte ${found.length} sélecteur(s) exclusif(s) de ${path.relative(ROOT, cssFile)}`);
    }
  }

  const intruders: string[] = [];
  for (const f of allCss) {
    if (f === cssFile) continue;
    for (const n of exclusive(f)) {
      if (bundled.includes(`.${n}`)) intruders.push(`${path.basename(f)}:.${n}`);
    }
  }
  if (intruders.length > 0) {
    const aucuneVariable = !env.SITE_CSS_CONTENT && !env.SITE_CSS_PATH && !env.VITE_SLUG;
    fail(
      `Le CSS bundlé contient des sélecteurs exclusifs d'AUTRES thèmes que ` +
        `${path.relative(ROOT, cssFile)} : ` +
        `${intruders.slice(0, 6).join(", ")}${intruders.length > 6 ? " …" : ""}` +
        (aucuneVariable
          ? `\n      Aucune variable de CSS n'a été fournie à verify:build, il a donc attendu ` +
            `le thème par défaut. Si le build en avait une, relancer avec les MÊMES variables ` +
            `(VITE_SLUG, SITE_CSS_PATH ou SITE_CSS_CONTENT).`
          : ""),
    );
  } else if (mine.length > 0) {
    ok("aucun sélecteur exclusif d'un autre thème dans le bundle");
  }
}

/* ── Verdict ─────────────────────────────────────────────────────────────── */

if (notes.length > 0) {
  console.log("");
  for (const n of notes) console.log(`  · ${n}`);
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} problème(s) :\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log("\n✓ dist/ correspond au site demandé.");
