/**
 * Amorce un NOUVEAU site depuis un archétype — les trois branchements que la
 * skill décrit en prose et que personne n'outillait (entrée `sites.json`,
 * dossier `public/images/<slug>/`, choix du CSS) étaient 100 % manuels, donc
 * oubliables. Le config produit est un SQUELETTE : chrome et thème hérités de
 * l'archétype, pages vides à composer avec `config:example -- --recipe <id>`.
 *
 * Usage :
 *   npx tsx scripts/config-init.ts <slug> --from <archétype> [options]
 *     --pages /,/agenda,/contact   chemins des pages à créer (défaut : /)
 *     --title "Nom du site"        titre (défaut : le slug)
 *     --css index-rezo-la-mer      CSS du site (défaut : celui de l'archétype)
 *     --dry-run                    n'écrit rien, imprime le plan
 *
 * NE crée PAS l'entité Cocolight : elle exige une authentification et reste à
 * la charge de l'utilisateur (`npm run entity:slug -- check <slug>` avant de
 * démarrer, sinon le site ne boote pas).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, loadConfig } from "./lib/archetypes";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const OPTION_NAMES = ["--from", "--pages", "--title", "--css"];
const slug = argv.find((a, i) => !a.startsWith("--") && !OPTION_NAMES.includes(argv[i - 1]));
const from = opt("--from");

const manifest = loadManifest();
if (!slug || !from) {
  console.error("Usage : config-init.ts <slug> --from <archétype> [--pages /,/a] [--title T] [--css index-x] [--dry-run]");
  console.error(`Archétypes : ${manifest.archetypes.map((a) => a.slug).join(", ")}`);
  process.exit(2);
}

const archetype = manifest.archetypes.find((a) => a.slug === from);
if (!archetype) {
  console.error(`✗ archétype inconnu : « ${from} » (${manifest.archetypes.map((a) => a.slug).join(", ")})`);
  process.exit(1);
}

// ─── Garde-fous : jamais d'écrasement silencieux ──────────────────────────
const sitesPath = path.join(ROOT, "sites.json");
const sites = JSON.parse(fs.readFileSync(sitesPath, "utf-8")) as { slug: string; config: string; css: string }[];
if (sites.some((s) => s.slug === slug)) {
  console.error(`✗ le slug « ${slug} » est DÉJÀ dans sites.json — choisir un autre, ou éditer le site existant`);
  process.exit(1);
}
const kebab = slug.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const configName = `config.prod.${kebab}.json`;
if (fs.existsSync(path.join(ROOT, configName))) {
  console.error(`✗ ${configName} existe déjà — rien n'est écrit`);
  process.exit(1);
}

const source = loadConfig(archetype.config) as Record<string, unknown>;
const sourceSite = sites.find((s) => s.config === archetype.config);
const css = opt("--css") ?? sourceSite?.css ?? "index";
const title = opt("--title") ?? slug;
const pagePaths = (opt("--pages") ?? "/").split(",").map((p) => p.trim()).filter(Boolean);

/** « /mentions-legales » → « Mentions legales » ; « / » → le titre du site. */
const titleOf = (p: string) =>
  p === "/" ? title : p.replace(/^\//, "").split("/").pop()!.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

const meta = source.meta as Record<string, unknown>;
const langs = (meta.languages as string[]) ?? ["fr"];
const localized = (s: string) => Object.fromEntries(langs.map((l) => [l, s]));

const header = structuredClone(source.header) as Record<string, unknown>;
const footer = structuredClone(source.footer) as Record<string, unknown>;
// La nav de l'archétype pointe SES pages : la conserver produirait autant de
// liens morts. On la reconstruit sur les pages demandées.
header.nav = pagePaths.filter((p) => p !== "/").map((p) => ({ label: localized(titleOf(p)), path: p }));
// Identité, assets et CTA de l'archétype : ni valides ni légitimes ici (un
// `ctaButton` hérité pointe une page qui n'existe pas ; un logo pointe un
// fichier absent). On garde la FORME du chrome, jamais son contenu.
for (const key of [
  "path", "logo", "logoImage", "logoDark", "logoAlt", "logoTitle", "logoSubtitle",
  "logoIcon", "entityLogoOverride", "ctaButton", "urgenceButton", "announcement", "piggyBank",
]) {
  delete header[key];
}
// `contactSection` porte l'adresse et l'email de l'archétype : les recopier dans
// un site neuf serait pire qu'un lien mort.
for (const key of [
  "columns", "partners", "socials", "newsletter", "contactSection", "legalLinks", "logo", "logoImage", "description",
]) {
  delete footer[key];
}
footer.copyright = localized(`© ${new Date().getFullYear()} ${title}`);

const config = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  meta: {
    ...meta,
    title: localized(title),
    description: localized(`Site ${title}`),
    // Les assets de l'archétype n'existent pas pour ce slug.
    ...(meta.favicon ? { favicon: "" } : {}),
    ...(meta.ogImage ? { ogImage: "" } : {}),
  },
  theme: structuredClone(source.theme),
  header,
  footer,
  pages: pagePaths.map((p) => ({
    path: p,
    title: localized(titleOf(p)),
    layout: "fullwidth",
    sections: [],
  })),
};

const plan = [
  `${configName}                      (squelette depuis ${archetype.config})`,
  `sites.json                          + { slug: "${slug}", config: "${configName}", css: "${css}" }`,
  `public/images/${slug}/               (dossier des assets du site)`,
];
console.log(`Plan (${DRY ? "DRY-RUN" : "écriture"}) :`);
for (const l of plan) console.log(`  ${l}`);
console.log(`\nHérité de « ${archetype.slug} » : theme complet, header.type=${String(header.type)}, footer.type=${String(footer.type)}`);
console.log(`Pages créées (VIDES, à composer) : ${pagePaths.join(", ")}`);

if (DRY) {
  console.log("\n--dry-run : rien n'a été écrit.");
  process.exit(0);
}

fs.writeFileSync(path.join(ROOT, configName), `${JSON.stringify(config, null, 2)}\n`);
fs.writeFileSync(sitesPath, `${JSON.stringify([...sites, { slug, config: configName, css }], null, 2)}\n`);
fs.mkdirSync(path.join(ROOT, "public/images", slug), { recursive: true });

console.log(`\n✓ ${configName} créé, sites.json mis à jour, public/images/${slug}/ créé.`);
console.log("\nSuite, dans l'ordre :");
console.log(`  1. npm run entity:slug -- check ${slug}      ← PRÉREQUIS DUR : sans entité, le site ne boote pas`);
console.log(`  2. npm run config:example                     ← choisir une recette par page`);
console.log(`     npm run config:example -- --recipe <id>    ← copier la page réelle, l'adapter`);
console.log(`  3. npm run config:validate -- ${configName}`);
console.log(`  4. npm run audit:config -- --file ${configName}`);
console.log(`  5. VITE_SLUG=${slug} npm run dev`);
