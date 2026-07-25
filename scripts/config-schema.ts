/**
 * Imprime le JSON Schema (z.toJSONSchema) d'un MORCEAU du schéma de site —
 * évite à l'assistant config (et aux humains) de relire les ~2000 lignes de
 * site-schema.ts pour connaître la forme exacte d'une section ou d'un bloc.
 * Cf. doc/26-assistant-config.md.
 *
 * Usage :
 *   npx tsx scripts/config-schema.ts sections          # liste type + description des sections (par famille)
 *   npx tsx scripts/config-schema.ts section:<type>    # JSON Schema d'une section (ex. section:pricing)
 *   npx tsx scripts/config-schema.ts header|footer|theme|meta|auth|page|profiles|integrations|commandPalette|costumForm|admin|root
 *
 * La SÉMANTIQUE des props (registre scripts/lib/prop-descriptions.ts) est
 * fusionnée dans la sortie (`description` sur les nœuds) ; les contraintes non
 * exportables (refinements .refine/.check) sortent en commentaires stderr —
 * toujours revalider avec scripts/validate-config.ts après génération.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { SiteConfig } from "../src/types/site-schema";
import SECTION_META, { SECTION_FAMILIES } from "../src/components/admin/section-meta";
import {
  sectionOptions,
  resolveBlockSchema,
  blockNote,
  applyDescriptions,
  ROOT_BLOCK_SELECTORS,
  type JsonSchemaNode,
} from "./lib/config-blocks";
import { PROP_DESCRIPTIONS, BLOCK_NOTES } from "./lib/prop-descriptions";
import { sectionPreviews, chromePreviews } from "./lib/design-previews";
import { presenterMatrix, optionIndex } from "./lib/presenter-options";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Sortie souvent pipée vers head/grep — ne pas crasher sur le tube fermé.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const arg = process.argv[2];

/**
 * Story de props RÉELLE du bloc, quand elle existe (.design-sync/previews/) :
 * le JSON Schema donne la forme, la story donne la COMPOSITION (ce qu'on
 * renseigne vraiment, avec des valeurs plausibles).
 */
function printPreviewHint(selector: string) {
  if (selector.startsWith("section:")) {
    const p = sectionPreviews(ROOT).get(selector.slice("section:".length));
    if (p) console.error(`// composition de props réelle : ${p}`);
    return;
  }
  if (selector === "header" || selector === "footer") {
    const files = chromePreviews(ROOT, selector === "header" ? "Header" : "Footer");
    if (files.length) console.error(`// rendu de chaque variante : ${files.join(", ")}`);
  }
}

/**
 * Sections à liste : quelles options de `list.card` / `list.preview` chaque
 * presenter honore RÉELLEMENT. Le schéma les décrit toutes au même niveau, mais
 * une option posée sur le mauvais `type` est ignorée en silence.
 */
function printPresenterMatrix(selector: string) {
  if (!["section:searchPro", "section:searchProStatic", "section:cardCountCT"].includes(selector)) return;
  const m = presenterMatrix(ROOT);
  console.error("// option × presenter (une option posée sur un autre type est IGNORÉE en silence) :");
  for (const [opt, types] of optionIndex(m.cards)) console.error(`//   card.${opt} → ${types.join(", ")}`);
  for (const [opt, types] of optionIndex(m.previews)) console.error(`//   preview.${opt} → ${types.join(", ")}`);
  for (const e of [...m.cards, ...m.previews]) {
    if (!e.receivesConfig && e.options.length)
      console.error(`// ⚠ ${e.type} lit ${e.options.join(", ")} mais le dispatcheur ne les lui TRANSMET PAS (option morte)`);
  }
  console.error("//   (les autres types n'ont pas d'option propre : leur rendu ne dépend que de la donnée)");
}

function print(selector: string, schema: z.ZodType) {
  const note = blockNote(selector);
  if (note) console.error(note);
  printPreviewHint(selector);
  printPresenterMatrix(selector);
  const json = z.toJSONSchema(schema, { unrepresentable: "any" }) as JsonSchemaNode;
  const descs = PROP_DESCRIPTIONS[selector];
  if (descs) {
    for (const missing of applyDescriptions(json, descs)) {
      console.error(`⚠ description sans cible : ${selector} → ${missing} (corriger scripts/lib/prop-descriptions.ts)`);
    }
  }
  for (const n of BLOCK_NOTES[selector] ?? []) {
    console.error(`// contrainte non exportable : ${n}`);
  }
  console.log(JSON.stringify(json, null, 2));
}

if (!arg) {
  console.error(
    `Usage : config-schema.ts <sections | section:<type> | ${ROOT_BLOCK_SELECTORS.join(" | ")} | root>`,
  );
  process.exit(2);
}

if (arg === "sections") {
  // Catalogue : type → description française (section-meta du panel admin), groupé par famille.
  const previews = sectionPreviews(ROOT);
  console.log(
    `# ◆ = story de props RÉELLE dans .design-sync/previews/ (${previews.size} types) — la copier plutôt qu'inventer\n` +
      `#   → npx tsx scripts/config-schema.ts section:<type> imprime son chemin exact`,
  );
  const byFamily = new Map<string, string[]>();
  for (const [type] of [...sectionOptions()].sort(([a], [b]) => a.localeCompare(b))) {
    const m = SECTION_META[type];
    const line = `${previews.has(type) ? "◆" : " "} ${type.padEnd(28)} ${m ? `${m.label} — ${m.desc}` : "(absent de section-meta)"}`;
    const family = m?.family ?? "(sans famille)";
    byFamily.set(family, [...(byFamily.get(family) ?? []), line]);
  }
  for (const family of [...SECTION_FAMILIES, "(sans famille)"]) {
    const lines = byFamily.get(family);
    if (!lines) continue;
    console.log(`\n# ${family}`);
    for (const line of lines) console.log(line);
  }
  process.exit(0);
}

if (arg === "root") {
  // Vue d'ensemble : clés racine + type sommaire (pas le schéma complet, volumineux).
  for (const [key, value] of Object.entries(SiteConfig.shape)) {
    const def = (value as z.ZodType).constructor.name.replace("Zod", "");
    console.log(`${key.padEnd(22)} ${def}`);
  }
  process.exit(0);
}

const schema = resolveBlockSchema(arg);
if (!schema) {
  if (arg.startsWith("section:")) {
    console.error(`✗ type de section inconnu : "${arg.slice("section:".length)}" (voir \`config-schema.ts sections\`)`);
    process.exit(1);
  }
  console.error(`✗ sélecteur inconnu : "${arg}"`);
  process.exit(2);
}
print(arg, schema);
