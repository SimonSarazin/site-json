/**
 * Générateur DÉTERMINISTE du bloc `config.admin` (RFC doc/31, fil B / F1) — le
 * squelette du back-office /admin (doc/30-module-admin.md) dérivé de la config
 * du site : `profiles.*.sections[].addConfig` (types proposés au dropdown
 * « Ajouter ») croisé avec `costumForms.<id>.entityType`. L'assistant config
 * (ou un humain) part de ce scaffold puis affine (labels, source, accès).
 *
 * Usage :  npx tsx scripts/admin-scaffold.ts <config.prod.X.json> [--write] [--force]
 *          npm run admin:scaffold -- config.prod.tiers-lieux.json
 *
 *  - sans --write : imprime le bloc `admin` (JSON 2 espaces) sur stdout ;
 *  - --write      : insère la clé "admin" dans le fichier — par INSERTION
 *    TEXTUELLE avant l'accolade finale (les configs du repo sont formatées à la
 *    main : objets inline, indentation irrégulière — un JSON.parse/stringify
 *    global reformaterait des milliers de lignes ; vérifié 2026-07-07) ;
 *  - une clé "admin" déjà présente n'est JAMAIS écrasée sans --force.
 *
 * Le bloc généré est validé par `AdminConfigSchema.safeParse` AVANT toute
 * sortie (un scaffold invalide = bug → exit 1 + erreurs), et après --write le
 * fichier est revérifié (reparse + le reste de la config byte-inchangé).
 * Sortie : exit 0 ; exit 1 = erreur (JSON invalide, scaffold invalide, refus
 * sans --force) ; exit 2 = usage/fichier introuvable.
 *
 * Boucle complète (cf. doc/26) : scaffold → `npm run config:validate` →
 * préversion /admin.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { z } from "zod";

import { AdminConfigSchema } from "../src/modules/admin/schema";

type AdminScaffold = z.input<typeof AdminConfigSchema>;
type AdminTabInput = NonNullable<AdminScaffold["tabs"]>[number];
type AdminSectionInput = AdminTabInput["sections"][number];

/** Erreur « métier » du scaffold (refus, insertion impossible) → exit 1 sans stack. */
export class ScaffoldError extends Error {}

/*───────────────────────────────────────────────────────────────*/
/* 1. Dérivation des types d'entités gérés par le site           */
/*───────────────────────────────────────────────────────────────*/

/** addConfig (AddConfigSchema, modules/profil) : clés SINGULIÈRES → collection. */
const ADD_CONFIG_TO_TYPE: Record<string, string> = {
  organization: "organizations",
  project: "projects",
  event: "events",
  poi: "poi",
};

/** Ordre stable des sections/entityTypes générés (extras inconnus : triés après). */
const CANONICAL_ORDER = ["organizations", "projects", "events", "poi", "citoyens"];

/** Types importables (aligné z.enum de AdminImportSectionSchema / IMPORT_ELEMENTS backend). */
export const IMPORTABLE_TYPES = ["poi", "organizations", "projects", "events", "citoyens"] as const;
/** Types exportables (défaut de la section export — plancher backend superAdmin). */
export const EXPORTABLE_TYPES = ["organizations", "projects", "poi", "events"] as const;

const FR_TYPE_LABELS: Record<string, string> = {
  organizations: "Organisations",
  projects: "Projets",
  events: "Événements",
  poi: "Points d'intérêt",
  citoyens: "Citoyens",
  answers: "Réponses",
};

/** Types sans adresse évidente → pas de colonne `address.addressLocality`. */
const ADDRESSLESS_TYPES = new Set(["citoyens", "answers"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(node: unknown, fn: (n: unknown) => void): void {
  fn(node);
  if (Array.isArray(node)) node.forEach((v) => walk(v, fn));
  else if (isRecord(node)) Object.values(node).forEach((v) => walk(v, fn));
}

/**
 * Types d'entités gérés par le site, en croisant :
 *  - tous les `addConfig` du sous-arbre `profiles` (clé absente = true, comme
 *    le défaut de `AddConfigSchema` ; `false` explicite = type désactivé) ;
 *  - chaque doc `costumForms.<id>` : `entityType` (sinon `mutation.entityType`,
 *    sinon `collection`).
 */
export function deriveEntityTypes(config: Record<string, unknown>): string[] {
  const found = new Set<string>();

  walk(config.profiles, (node) => {
    if (!isRecord(node) || !isRecord(node.addConfig)) return;
    for (const [key, type] of Object.entries(ADD_CONFIG_TO_TYPE)) {
      if (node.addConfig[key] !== false) found.add(type);
    }
  });

  if (isRecord(config.costumForms)) {
    for (const doc of Object.values(config.costumForms)) {
      if (!isRecord(doc)) continue;
      const t =
        doc.entityType ?? (isRecord(doc.mutation) ? doc.mutation.entityType : undefined) ?? doc.collection;
      if (typeof t === "string" && t) found.add(t);
    }
  }

  return [
    ...CANONICAL_ORDER.filter((t) => found.has(t)),
    ...[...found].filter((t) => !CANONICAL_ORDER.includes(t)).sort(),
  ];
}

/*───────────────────────────────────────────────────────────────*/
/* 2. Construction du bloc admin                                 */
/*───────────────────────────────────────────────────────────────*/

function frLabel(type: string): string {
  return FR_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

function resourceSection(type: string): AdminSectionInput {
  const columns: NonNullable<Extract<AdminSectionInput, { type: "resource" }>["columns"]> = ["name"];
  if (!ADDRESSLESS_TYPES.has(type)) {
    columns.push({ path: "address.addressLocality", label: { fr: "Commune" } });
  }
  return {
    type: "resource",
    entityType: type,
    label: { fr: frLabel(type) },
    columns,
    create: "inherit",
    edit: "inherit",
    rowActions: ["edit", "delete", "validate", "reference"],
    bulkActions: ["validate", "export", "delete"],
  };
}

/** Le bloc `config.admin` complet (dashboard, members, content, import-export,
 *  reference, moderation) — les onglets liés au contenu sont omis si le site ne
 *  gère aucun type d'entité. */
export function deriveAdminConfig(config: Record<string, unknown>): AdminScaffold {
  const types = deriveEntityTypes(config);
  const tabs: AdminTabInput[] = [
    {
      id: "dashboard",
      label: { fr: "Tableau de bord" },
      icon: "layout-dashboard",
      sections: [{ type: "dashboard" }],
    },
    {
      id: "members",
      label: { fr: "Membres" },
      icon: "users",
      access: "siteAdmin",
      sections: [{ type: "members", filters: ["toBeValidated", "isAdmin", "isInviting", "text"] }],
    },
  ];

  if (types.length > 0) {
    tabs.push({
      id: "content",
      label: { fr: "Contenu" },
      icon: "database",
      sections: types.map(resourceSection),
    });

    const importables = IMPORTABLE_TYPES.filter((t) => types.includes(t));
    const exportables = EXPORTABLE_TYPES.filter((t) => types.includes(t));
    const ieSections: AdminSectionInput[] = [];
    if (importables.length > 0) ieSections.push({ type: "import", entityTypes: importables });
    if (exportables.length > 0) ieSections.push({ type: "export", entityTypes: [...exportables] });
    if (ieSections.length > 0) {
      tabs.push({
        id: "import-export",
        label: { fr: "Import / Export" },
        icon: "arrow-down-up",
        access: "siteAdmin",
        sections: ieSections,
      });
    }

    tabs.push({
      id: "reference",
      label: { fr: "Référencement" },
      icon: "link-2",
      access: "siteAdmin",
      sections: [{ type: "reference", entityTypes: types }],
    });
  }

  tabs.push({
    id: "moderation",
    label: { fr: "Modération" },
    icon: "shield-alert",
    access: "superAdmin",
    sections: [{ type: "moderation" }],
  });

  return { enabled: true, access: { min: "siteAdmin" }, tabs };
}

/*───────────────────────────────────────────────────────────────*/
/* 3. Insertion textuelle prudente dans le fichier de config     */
/*───────────────────────────────────────────────────────────────*/

/** Indente toutes les lignes SAUF la première (le préfixe `"admin": ` la porte déjà). */
function indentLines(json: string, indent: string): string {
  return json
    .split("\n")
    .map((line, i) => (i === 0 ? line : indent + line))
    .join("\n");
}

/** Unité d'indentation du fichier (première ligne de clé indentée ; défaut 2 espaces). */
function detectIndent(raw: string): string {
  const m = raw.match(/\n([ \t]+)"/);
  return m ? m[1] : "  ";
}

/** Fin (exclusive) de la valeur JSON qui commence à `start` (suivi chaînes/échappements). */
function consumeValue(raw: string, start: number): number {
  let i = start;
  const first = raw[i];
  if (first === '"' || first === "{" || first === "[") {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < raw.length; i++) {
      const c = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') {
          inStr = false;
          if (depth === 0) return i + 1; // valeur = chaîne nue
        }
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    throw new ScaffoldError("valeur JSON non terminée (fichier corrompu ?)");
  }
  // Scalaire nu (nombre, true/false/null) : jusqu'au premier délimiteur.
  while (i < raw.length && !/[,\]}\s]/.test(raw[i])) i++;
  return i;
}

/** Étendue textuelle `[start, end)` de `"key": <valeur>` au NIVEAU RACINE, ou null. */
export function findTopLevelKeySpan(raw: string, key: string): { start: number; end: number } | null {
  let depth = 0;
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"') {
      const strStart = i;
      i++;
      let esc = false;
      while (i < raw.length) {
        const ch = raw[i];
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') break;
        i++;
      }
      const content = raw.slice(strStart + 1, i);
      i++; // après le guillemet fermant
      if (depth === 1 && content === key) {
        let j = i;
        while (j < raw.length && /\s/.test(raw[j])) j++;
        if (raw[j] === ":") {
          j++;
          while (j < raw.length && /\s/.test(raw[j])) j++;
          return { start: strStart, end: consumeValue(raw, j) };
        }
      }
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    i++;
  }
  return null;
}

/** Insère `"admin": <block>` juste avant l'accolade finale (le reste du fichier est intouché). */
function insertAdminKey(raw: string, block: unknown, indent: string): string {
  const closeIdx = raw.lastIndexOf("}");
  if (closeIdx === -1 || raw.slice(closeIdx + 1).trim() !== "") {
    throw new ScaffoldError("objet racine JSON introuvable (accolade finale)");
  }
  let bodyEnd = closeIdx - 1;
  while (bodyEnd >= 0 && /\s/.test(raw[bodyEnd])) bodyEnd--;
  if (bodyEnd < 0) throw new ScaffoldError("fichier de config vide");
  const needsComma = raw[bodyEnd] !== "{" && raw[bodyEnd] !== ",";
  const snippet = `${indent}"admin": ` + indentLines(JSON.stringify(block, null, 2), indent);
  return raw.slice(0, bodyEnd + 1) + (needsComma ? "," : "") + "\n" + snippet + "\n" + raw.slice(closeIdx);
}

/** Remplace la valeur de la clé racine `"admin"` existante, à sa place et son indentation. */
function replaceAdminKey(raw: string, block: unknown): string {
  const span = findTopLevelKeySpan(raw, "admin");
  if (!span) throw new ScaffoldError('clé racine "admin" introuvable pour le remplacement');
  const lineStart = raw.lastIndexOf("\n", span.start) + 1;
  const prefix = raw.slice(lineStart, span.start);
  const indent = /^[ \t]*$/.test(prefix) ? prefix : "  ";
  const snippet = `"admin": ` + indentLines(JSON.stringify(block, null, 2), indent);
  return raw.slice(0, span.start) + snippet + raw.slice(span.end);
}

/**
 * Contenu du fichier de config avec le bloc `admin` posé/remplacé — PUR (ne
 * touche pas au disque). Refuse d'écraser une clé `admin` existante sans
 * `force`. Vérifie l'intégrité du résultat AVANT de le rendre : reparse OK,
 * `admin` strictement égal au bloc, tout le reste de la config inchangé.
 */
export function applyAdminBlock(raw: string, block: unknown, opts: { force?: boolean } = {}): string {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new ScaffoldError("la config doit être un objet JSON racine");
  const hasAdmin = Object.prototype.hasOwnProperty.call(parsed, "admin");
  if (hasAdmin && !opts.force) {
    throw new ScaffoldError('la config contient déjà une clé "admin" — relancer avec --force pour la remplacer');
  }

  const next = hasAdmin ? replaceAdminKey(raw, block) : insertAdminKey(raw, block, detectIndent(raw));

  let reparsed: unknown;
  try {
    reparsed = JSON.parse(next);
  } catch {
    throw new ScaffoldError("le résultat de l'insertion ne reparse pas (bug) — fichier NON modifié");
  }
  const withoutAdmin = (o: Record<string, unknown>): string => {
    const c = { ...o };
    delete c.admin;
    return JSON.stringify(c);
  };
  if (
    !isRecord(reparsed) ||
    JSON.stringify(reparsed.admin) !== JSON.stringify(block) ||
    withoutAdmin(reparsed) !== withoutAdmin(parsed)
  ) {
    throw new ScaffoldError("le résultat de l'insertion diverge de l'attendu (bug) — fichier NON modifié");
  }
  return next;
}

/*───────────────────────────────────────────────────────────────*/
/* 4. CLI                                                        */
/*───────────────────────────────────────────────────────────────*/

export function parseArgs(argv: string[]): { file: string; write: boolean; force: boolean } | { error: string } {
  let file: string | undefined;
  let write = false;
  let force = false;
  for (const arg of argv) {
    if (arg === "--write") write = true;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("--")) return { error: `flag inconnu : ${arg}` };
    else if (file) return { error: `argument en trop : ${arg}` };
    else file = arg;
  }
  if (!file) return { error: "fichier de config manquant" };
  return { file, write, force };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(`✗ ${args.error}`);
    console.error("Usage : npx tsx scripts/admin-scaffold.ts <config.prod.X.json> [--write] [--force]");
    process.exit(2);
  }
  if (!fs.existsSync(args.file)) {
    console.error(`✗ introuvable : ${args.file}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(args.file, "utf-8");
  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    console.error(`✗ JSON invalide : ${(e as Error).message}`);
    process.exit(1);
  }
  if (!isRecord(config)) {
    console.error("✗ la config doit être un objet JSON racine");
    process.exit(1);
  }

  const types = deriveEntityTypes(config);
  if (types.length === 0) {
    console.error(
      "⚠ aucun type d'entité dérivé (ni addConfig dans profiles, ni costumForms) — " +
        "onglets content/import-export/reference omis."
    );
  }
  const block = deriveAdminConfig(config);

  // Un scaffold invalide = bug du générateur : jamais de sortie non conforme.
  const check = AdminConfigSchema.safeParse(block);
  if (!check.success) {
    console.error(`✗ le scaffold généré échoue AdminConfigSchema (bug du générateur) :`);
    for (const issue of check.error.issues) {
      console.error(`  ${issue.path.length ? issue.path.join(".") : "(racine)"}\n    → ${issue.message} [${issue.code}]`);
    }
    process.exit(1);
  }

  if (Object.prototype.hasOwnProperty.call(config, "admin")) {
    console.error(
      `⚠ ${args.file} contient déjà une clé "admin"` +
        (args.write && !args.force ? " — --write refusé sans --force." : args.force ? " — remplacée (--force)." : ".")
    );
  }

  if (!args.write) {
    console.log(JSON.stringify(block, null, 2));
    process.exit(0);
  }

  try {
    fs.writeFileSync(args.file, applyAdminBlock(raw, block, { force: args.force }), "utf-8");
  } catch (e) {
    if (e instanceof ScaffoldError) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  console.error(
    `✓ clé "admin" ${args.force ? "remplacée" : "insérée"} dans ${args.file} — ` +
      `${types.length} type(s) : ${types.join(", ") || "(aucun)"}. ` +
      `Relancer : npm run config:validate -- ${args.file}`
  );
  process.exit(0);
}

// Garde d'exécution directe : le module reste importable par les tests sans lancer le CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
