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

// Sortie souvent pipée vers head/grep — ne pas crasher sur le tube fermé.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const arg = process.argv[2];

function print(selector: string, schema: z.ZodType) {
  const note = blockNote(selector);
  if (note) console.error(note);
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
  const byFamily = new Map<string, string[]>();
  for (const [type] of [...sectionOptions()].sort(([a], [b]) => a.localeCompare(b))) {
    const m = SECTION_META[type];
    const line = `${type.padEnd(28)} ${m ? `${m.label} — ${m.desc}` : "(absent de section-meta)"}`;
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
