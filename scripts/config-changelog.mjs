/**
 * CHANGELOG DE CONTRAT — quand chaque clé de config est apparue, et quand chaque site l'a adoptée.
 *
 * POURQUOI. La connaissance du parc est écrite (61 messages de commit sur 200 décrivent leur impact
 * sur les autres sites) mais indexée par DATE. Personne ne peut demander « depuis quand cette clé
 * existe-t-elle » ni « qui l'utilise ». Ce script fournit l'index manquant.
 *
 * DEUX SOURCES, deux questions distinctes :
 *  - `schema`  : quand une clé est apparue dans le CONTRAT (les schémas Zod) → le millésime du moteur ;
 *  - `configs` : quand un SITE l'a adoptée → le millésime de chaque config.
 * L'écart entre les deux est exactement la dérive qu'on cherche à voir.
 *
 * RIEN N'EST STOCKÉ. Tout est recalculé à chaque appel — quelques secondes pour les 20 fichiers de
 * schéma (776 clés) et les 16 configs (5 350 couples). C'est délibéré : `docs/CONFIG-SURFACE.md` a
 * prouvé qu'un artefact généré une fois puis committé dérive (il annonce 13 configs sur 16 et une CI
 * qui n'existe pas). Un artefact qui se régénère en quelques secondes ne peut pas mentir.
 *
 * UNE SEULE PASSE PAR FICHIER. `git log -S <clé>` coûte ~5 s ; sur 776 clés c'est une demi-heure. Un
 * `git log -p --reverse` par fichier, parsé au fil de l'eau, fait le même travail en une seconde.
 *
 * LIMITES ASSUMÉES (heuristique de PREMIÈRE APPARITION) :
 *  - une clé retirée puis remise porte sa date d'origine ;
 *  - un renommage compte comme une naissance ;
 *  - les clés du commit initial d'un fichier partagent toutes sa date ;
 *  - côté configs, le motif attrape toute clé JSON — y compris les champs de données (`label`, `fr`).
 *    C'est voulu : on interroge par clé précise, le bruit ne gêne pas.
 *
 * Usage :
 *   node scripts/config-changelog.mjs schema              → clés du contrat, par date
 *   node scripts/config-changelog.mjs configs             → adoption par site
 *   node scripts/config-changelog.mjs key <nom>           → courbe de diffusion d'une clé
 *   node scripts/config-changelog.mjs since <config>      → clés nées depuis la dernière ADOPTION du site
 *   node scripts/config-changelog.mjs candidates          → possibilités peu ou pas exercées (liste de travail des fiches)
 *   … --json                                              → sortie machine
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join as joinPath } from "node:path";

/**
 * La surface du contrat n'est PAS `site-schema.ts` seul : il importe les schémas de sections et de
 * blocs depuis les modules (`profil`, `search`, `admin`, `blog`, `agenda`, `observatoire`, `news`,
 * `notification`, `ampli`, `commandPalette`, `coform`, `toolsCatalog`, `visibility`…). Une liste
 * écrite à la main les rate — la première version de ce script en oubliait sept, dont
 * `modules/profil/schema.ts` où vivent `editModal`, `editModalMatch`, `editModals` et `when`.
 *
 * On résout donc le graphe d'imports depuis la racine, transitivement. Un module dont le schéma sera
 * importé demain entre dans le changelog sans qu'on touche à ce fichier.
 */
const RACINE_SCHEMA = "src/types/site-schema.ts";

/**
 * SUPPLÉMENT — schémas qui décrivent de la config RÉELLE mais que le graphe d'imports ne peut pas
 * atteindre, parce que la racine type le bloc de façon permissive.
 *
 * Un seul cas aujourd'hui, vérifié : `site-schema.ts` déclare `costumForms: z.record(z.string(),
 * z.unknown())` — volontairement, « la structure est validée par le compilateur/registre, durcissement
 * zod = à part ». Le schéma strict vit donc dans `costumFormSchema.zod.ts`, importé par le registre et
 * par les scripts, jamais par la racine. Sans ce supplément, `identity`, `subType`, `scope` et tout le
 * contrat costum sortent « introuvables » du changelog.
 *
 * À n'étendre que pour un bloc dont on a VÉRIFIÉ qu'il est typé permissivement en racine — sinon on
 * retombe sur la liste écrite à la main, qui dérive.
 */
const SUPPLEMENT = ["src/modules/profil/forms/costum/costumFormSchema.zod.ts"];

function resolutionImports(depart) {
  const vus = new Set();
  const file = [depart];
  while (file.length) {
    const f = file.shift();
    if (vus.has(f)) continue;
    vus.add(f);
    let src;
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    for (const m of src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
      const spec = m[1];
      let base;
      if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
      else if (spec.startsWith(".")) base = joinPath(dirname(f), spec);
      else continue; // paquet npm
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const cand = base.endsWith(".ts") || base.endsWith(".tsx") ? base : base + ext;
        if (existsSync(cand)) { file.push(cand); break; }
      }
    }
  }
  for (const f of SUPPLEMENT) vus.add(f);
  // On ne garde que les fichiers qui déclarent réellement des clés de config Zod.
  return [...vus].filter((f) => {
    try { return /^\s{2,}\w+\s*:\s*(?:z\.|[A-Z]\w*)/m.test(readFileSync(f, "utf8")); } catch { return false; }
  }).sort();
}

let SCHEMAS = null;
const schemas = () => (SCHEMAS ??= resolutionImports(RACINE_SCHEMA));

const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

/** Parcourt l'historique d'un fichier et note la PREMIÈRE apparition de chaque clé. */
function premieresApparitions(fichier, motif) {
  let sortie;
  try {
    sortie = git([
      "log", "-p", "--reverse", "--unified=0",
      "--format=@@C@@%H|%ad|%an|%s", "--date=short", "--", fichier,
    ]);
  } catch {
    return {}; // fichier absent de l'historique
  }
  const vues = {};
  let ctx = null;
  for (const ligne of sortie.split("\n")) {
    if (ligne.startsWith("@@C@@")) {
      const [sha, date, auteur, ...reste] = ligne.slice(5).split("|");
      ctx = { sha: sha.slice(0, 8), date, auteur, sujet: reste.join("|") };
      continue;
    }
    if (motif === MOTIF_SCHEMA && EST_INTERFACE_TS(ligne)) continue;
    // `matchAll` et non `exec` : une ligne peut porter PLUSIEURS clés
    // (`z.object({ a: z.string(), b: z.number() })`) — 50 clés du parc sont dans ce cas.
    for (const m of ligne.matchAll(motif.global ? motif : new RegExp(motif.source, "g"))) {
      if (ctx && !vues[m[1]]) vues[m[1]] = { ...ctx, fichier };
    }
  }
  return vues;
}

/**
 * Une clé de config se déclare de DEUX façons, et n'en attraper qu'une en rate 17 % :
 *   `titre: z.string()`            → primitive
 *   `admin: AdminConfigSchema`     → référence à un sous-schéma
 * La seconde forme porte justement les clés STRUCTURELLES — `admin`, `baseParams`, `card`,
 * `preview`, `list`, `itemAction`, `filterGroups`… Sans elles le changelog ne voyait que les feuilles.
 *
 * Faux positifs écartés : les champs d'INTERFACE TypeScript, qui cohabitent dans ces fichiers. Ils se
 * distinguent sûrement — ils finissent par `;` ou portent `?:` (mesuré : 3 cas sur 945 candidats).
 */
const MOTIF_SCHEMA = /(?:^\+\s*|[{,]\s*)(\w+)\s*:\s*(?:z\.|[A-Z]\w*)/g;
const EST_INTERFACE_TS = (l) => /\?\s*:/.test(l) || l.trimEnd().endsWith(";");
const MOTIF_CONFIG = /^\+\s*"([\w.$-]+)"\s*:/g;

/**
 * Les clés VIVANTES : celles présentes dans les schémas d'AUJOURD'HUI.
 *
 * Le changelog date les NAISSANCES depuis l'historique git ; il n'a aucune notion de mort. Mesuré :
 * 84 des 928 clés datées (9 %) n'existent plus dans aucun schéma — renommées, retirées, ou artefacts
 * de parsing d'un diff ancien. Les servir comme du contrat actuel, c'est répondre « cette clé existe
 * depuis le 12 juin » sur une clé qui n'existe plus.
 *
 * On garde donc git pour DATER, et l'état courant pour dire ce qui EST.
 */
function clesVivantes() {
  const vivantes = new Set();
  for (const f of schemas()) {
    let src;
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    for (const ligne of src.split("\n")) {
      if (EST_INTERFACE_TS(ligne)) continue;
      for (const m of ligne.matchAll(/(?:^\s{2,}|[{,]\s*)(\w+)\s*:\s*(?:z\.|[A-Z]\w*)/g)) vivantes.add(m[1]);
    }
  }
  return vivantes;
}

function changelogSchema({ inclureMortes = false } = {}) {
  const out = {};
  const vivantes = inclureMortes ? null : clesVivantes();
  for (const f of schemas()) {
    for (const [cle, info] of Object.entries(premieresApparitions(f, MOTIF_SCHEMA))) {
      if (vivantes && !vivantes.has(cle)) continue; // née puis disparue du contrat
      // Une clé peut exister dans plusieurs schémas : on garde la PLUS ANCIENNE.
      if (!out[cle] || info.date < out[cle].date) out[cle] = info;
    }
  }
  return out;
}

const configs = () =>
  readdirSync(".").filter((f) => /^config\.prod.*\.json$/.test(f)).sort();

function changelogConfigs() {
  const out = {};
  for (const f of configs()) out[f] = premieresApparitions(f, MOTIF_CONFIG);
  return out;
}

/** Dernière date où un fichier a été touché — tous commits confondus. */
const derniereTouche = (f) =>
  git(["log", "-1", "--format=%ad", "--date=short", "--", f]).trim();

/**
 * Dernière fois que cette config a réellement ADOPTÉ quelque chose.
 *
 * `derniereTouche` ne vaut rien comme repère de travail : une édition mécanique du parc remet le
 * compteur à zéro. Vécu — la « dernière touche » de sport-sante-bien-etre au 2026-08-23 est une
 * suppression de DEUX lignes (retrait de `action`/`method` du formulaire de contact, appliqué à
 * tous les sites), après quoi `since` ne trouvait plus rien alors que le site est en retard sur
 * huit clés. On date donc sur la dernière clé GAGNÉE, pas sur le dernier octet modifié.
 */
function derniereAdoption(f, adoptions) {
  const dates = Object.values(adoptions).map((i) => i.date);
  return dates.length ? dates.sort().at(-1) : derniereTouche(f);
}

// ── sorties ───────────────────────────────────────────────────────────────────
const [mode, arg] = process.argv.slice(2).filter((a) => a !== "--json");
const json = process.argv.includes("--json");
const nom = (f) => f.replace(/^config\.prod\.?/, "").replace(/\.json$/, "") || "(défaut)";

if (mode === "schema") {
  const cl = changelogSchema();
  if (json) { console.log(JSON.stringify(cl, null, 1)); process.exit(0); }
  const lignes = Object.entries(cl).sort((a, b) => a[1].date.localeCompare(b[1].date));
  console.log(`${lignes.length} clés de contrat datées\n`);
  const parMois = {};
  for (const [, i] of lignes) parMois[i.date.slice(0, 7)] = (parMois[i.date.slice(0, 7)] ?? 0) + 1;
  for (const [m, n] of Object.entries(parMois)) console.log(`  ${m}  ${String(n).padStart(3)} ${"█".repeat(Math.min(n, 50))}`);
  console.log(`\n30 dernières :`);
  for (const [c, i] of lignes.slice(-30)) console.log(`  ${i.date}  ${c.padEnd(26)} ${i.sujet.slice(0, 66)}`);
}

else if (mode === "configs") {
  const cl = changelogConfigs();
  if (json) { console.log(JSON.stringify(cl, null, 1)); process.exit(0); }
  console.log(`${Object.keys(cl).length} configs\n`);
  for (const [f, v] of Object.entries(cl).sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)) {
    console.log(`  ${nom(f).padEnd(28)} ${String(Object.keys(v).length).padStart(4)} clés · dernière touche ${derniereTouche(f)}`);
  }
}

else if (mode === "key") {
  if (!arg) { console.error("usage : key <nom>"); process.exit(2); }
  const naiss = changelogSchema()[arg];
  console.log(`\nClé « ${arg} »`);
  if (naiss) {
    console.log(`  contrat : née le ${naiss.date} (${naiss.sha}, ${naiss.auteur}) — ${naiss.fichier}`);
    console.log(`            ${naiss.sujet}`);
  } else {
    // Distinguer « n'a jamais existé » de « a existé et n'existe plus » : la seconde réponse est une
    // information, la première un signal que la clé est hors du périmètre suivi.
    const ancienne = changelogSchema({ inclureMortes: true })[arg];
    console.log(ancienne
      ? `  contrat : RETIRÉE — née le ${ancienne.date} (${ancienne.sha}), absente des schémas actuels\n            ${ancienne.sujet}`
      : `  contrat : jamais vue dans les schémas suivis (hors périmètre, ou clé de données)`);
  }
  const cl = changelogConfigs();
  const porteurs = Object.entries(cl).filter(([, v]) => v[arg]).sort((a, b) => a[1][arg].date.localeCompare(b[1][arg].date));
  console.log(`\n  adoption : ${porteurs.length} / ${Object.keys(cl).length} configs`);
  for (const [f, v] of porteurs) console.log(`    ${v[arg].date}  ${nom(f)}`);
  const absents = Object.keys(cl).filter((f) => !cl[f][arg]);
  if (absents.length) console.log(`\n  absente de : ${absents.map(nom).join(", ")}`);
}

else if (mode === "since") {
  if (!arg) { console.error("usage : since <config>"); process.exit(2); }
  const f = configs().find((c) => c.includes(arg));
  if (!f) { console.error(`config introuvable : ${arg}`); process.exit(2); }
  const cl = changelogSchema();
  const mienne = premieresApparitions(f, MOTIF_CONFIG);
  const adoption = derniereAdoption(f, mienne);
  const touche = derniereTouche(f);
  const depuis = Object.entries(cl)
    .filter(([c, i]) => i.date > adoption && !mienne[c])
    .sort((a, b) => a[1].date.localeCompare(b[1].date));
  console.log(`\n${nom(f)} — dernière ADOPTION : ${adoption}` +
    (touche !== adoption ? `  (dernière touche : ${touche}, sans rien gagner)` : ""));
  console.log(`${depuis.length} clé(s) de contrat née(s) depuis, et absente(s) de cette config :\n`);
  for (const [c, i] of depuis) console.log(`  ${i.date}  ${c.padEnd(26)} ${i.sujet.slice(0, 64)}`);
  console.log(`\n⚠️  Une clé absente n'est PAS un manque : la plupart des clés optionnelles ne`);
  console.log(`   doivent pas être posées. Cette liste dit ce qui a bougé, pas ce qu'il faut faire.`);
}

else if (mode === "candidates") {
  /**
   * MÉCANISMES CANDIDATS À UNE FICHE.
   *
   * Un mécanisme = les clés nées dans le MÊME commit. C'est le « ce qui va avec quoi » — celui qu'on
   * écrit à la main sinon (les trois pièces des listes vivantes, la chaîne de rattachement) et qui se
   * dérive ici sans effort.
   *
   * Classé par ADOPTION croissante : le haut de la liste est ce qui est POSSIBLE et peu connu.
   *
   * ⚠️ Une adoption à 0 n'est PAS du contrat mort. C'est une possibilité que personne n'a encore
   * exercée — et pour qui démarre une config, c'est le groupe le plus utile, puisque c'est
   * exactement ce qu'il ne peut pas deviner. Ne jamais lire cette liste comme un ménage à faire :
   * l'absence d'usage n'est pas un défaut, ici pas plus qu'ailleurs.
   *
   * ⚠️ Ce que cette liste NE dit PAS : à quelle question chaque mécanisme répond, ni quels autres
   * mécanismes répondent à la MÊME. C'est le seul travail humain, et il est irréductible — des
   * réponses concurrentes naissent à des mois d'écart dans des commits sans rapport (`enumOrOther`,
   * un `enum` simple et `optionsFrom` répondent tous à « cette liste doit-elle grandir ? » et rien ne
   * les relie). Cette absence de lien est exactement celle qui rend le choix invisible à qui écrit.
   */
  const depuis = process.argv.includes("--depuis")
    ? process.argv[process.argv.indexOf("--depuis") + 1] : "0000-00";
  // Pas de plancher de date par défaut : le filtre de TAILLE de groupe (≤12) écarte déjà les commits
  // de création de fichier. Un plancher à 2026-06 masquait 253 des 287 mécanismes — dont tout ce qui
  // a été construit avant, et qui est justement le plus oublié.
  const cl = changelogSchema();
  const cfgs = changelogConfigs();
  const adoption = (k) => Object.entries(cfgs).filter(([, v]) => v[k]).map(([f]) => nom(f));

  const groupes = new Map();
  for (const [cle, i] of Object.entries(cl)) {
    const k = `${i.sha}|${i.date}|${i.sujet}`;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(cle);
  }
  const meca = [...groupes.entries()]
    .map(([k, cles]) => {
      const [sha, date, ...s] = k.split("|");
      // Le plus adopté du groupe fait foi : une clé annexe peu posée ne doit pas déclasser
      // un mécanisme par ailleurs répandu.
      const porteurs = cles.map((c) => adoption(c)).sort((a, b) => b.length - a.length)[0] ?? [];
      return { sha, date, sujet: s.join("|"), cles, porteurs };
    })
    // ≥2 clés = un ensemble ; ≤12 = on écarte les commits de CRÉATION de fichier, qui posent des
    // dizaines de clés d'un coup et ne sont pas des mécanismes (le socle de 2025-06 en pose 220).
    .filter((m) => m.cles.length >= 2 && m.cles.length <= 12 && m.date >= depuis)
    .sort((a, b) => a.porteurs.length - b.porteurs.length || a.date.localeCompare(b.date));

  if (json) { console.log(JSON.stringify(meca, null, 1)); process.exit(0); }

  const morts = meca.filter((m) => m.porteurs.length === 0);
  const orphelins = meca.filter((m) => m.porteurs.length === 1);
  console.log(`${meca.length} mécanismes (≥2 clés nées ensemble)${depuis === "0000-00" ? "" : ` depuis ${depuis}`}\n`);

  if (morts.length) {
    console.log(`\x1b[1m${morts.length} POSSIBILITÉS JAMAIS EXERCÉES — disponibles, jamais posées\x1b[0m`);
    console.log(`  (à connaître avant d'en réinventer une : ce n'est pas du ménage à faire)\n`);
    for (const m of morts) console.log(`  ${m.date}  ${m.cles.sort().join(", ")}\n            ${m.sujet.slice(0, 88)}`);
    console.log();
  }
  console.log(`\x1b[1m${orphelins.length} EXERCÉES PAR UN SEUL SITE — le porteur montre comment faire\x1b[0m\n`);
  for (const m of orphelins) {
    console.log(`  ${m.porteurs[0].padEnd(26)} ${m.date}  ${m.cles.sort().slice(0, 6).join(", ")}`);
    console.log(`  ${" ".repeat(26)} ${m.sujet.slice(0, 88)}`);
  }
  console.log(`\nPour chaque candidate, deux questions — et elles ne se dérivent pas :`);
  console.log(`  1. à quelle question ce mécanisme répond-il, telle qu'on se la pose en écrivant ?`);
  console.log(`  2. quoi d'autre répond à la MÊME question, et à quel prix ?`);
  console.log(`Les réponses vont dans .claude/skills/config-assistant/besoins.json.`);
}

else {
  console.log("usage : node scripts/config-changelog.mjs <schema|configs|key <nom>|since <config>|candidates [--depuis YYYY-MM]> [--json]");
  process.exit(2);
}
